import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { deliveryStatusSchema, parseBody, uuidSchema } from '@/lib/validation/schemas'

export const dynamic = 'force-dynamic'

/*
 * Rider UI actions -> delivery/order statuses
 *
 * Rider page sends:
 *
 * PICKED_UP
 * START_DELIVERY
 * DELIVERED
 *
 * The database uses:
 *
 * PICKED_UP
 * IN_TRANSIT
 * DELIVERED
 */
const ACTION_TO_STATUS: Record<string, string> = {
  PICKED_UP: 'PICKED_UP',
  START_DELIVERY: 'IN_TRANSIT',
  IN_TRANSIT: 'IN_TRANSIT',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
}

/*
 * Delivery status -> order status
 */
const ORDER_STATUS_MAP: Record<string, string> = {
  PICKED_UP: 'PICKED_UP',
  IN_TRANSIT: 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
}

/*
 * Delivery status values stored in the deliveries table.
 */
const DELIVERY_STATUS_MAP: Record<string, string> = {
  PICKED_UP: 'PICKED_UP',
  IN_TRANSIT: 'IN_TRANSIT',
  OUT_FOR_DELIVERY: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
}


/*
 * PATCH /api/deliveries/[id]
 *
 * The rider page sends:
 *
 * {
 *   action: "PICKED_UP"
 * }
 *
 * or:
 *
 * {
 *   action: "START_DELIVERY"
 * }
 *
 * or:
 *
 * {
 *   action: "DELIVERED"
 * }
 *
 * We also support:
 *
 * {
 *   status: "PICKED_UP"
 * }
 *
 * for backwards compatibility.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  /*
   * Authenticate rider.
   */
  const auth = await requireRole('RIDER')

  if (auth.error) {
    return auth.error
  }

  const { user } = auth


  /*
   * Validate delivery ID.
   */
  const idCheck = uuidSchema.safeParse(params.id)

  if (!idCheck.success) {
    return NextResponse.json(
      {
        error: 'Invalid delivery id',
        details: idCheck.error.flatten(),
      },
      {
        status: 400,
      }
    )
  }

  const deliveryId = idCheck.data


  /*
   * Read JSON safely.
   */
  let body: any

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      {
        error: 'Invalid JSON body',
      },
      {
        status: 400,
      }
    )
  }


  /*
   * IMPORTANT FIX:
   *
   * The rider page sends "action".
   *
   * The old API expected "status".
   *
   * We now support BOTH.
   */
  const requestedAction =
    typeof body?.action === 'string'
      ? body.action
      : typeof body?.status === 'string'
        ? body.status
        : null


  /*
   * Make sure an action/status was supplied.
   */
  if (!requestedAction) {
    return NextResponse.json(
      {
        error: 'Invalid status',
        details: {
          formErrors: [
            'action or status is required',
          ],
        },
      },
      {
        status: 400,
      }
    )
  }


  /*
   * Convert UI action into the canonical status.
   *
   * START_DELIVERY -> IN_TRANSIT
   */
  const normalizedStatus =
    ACTION_TO_STATUS[requestedAction]

  if (!normalizedStatus) {
    return NextResponse.json(
      {
        error: 'Invalid status',
        details: {
          formErrors: [
            `Unsupported action: ${requestedAction}`,
          ],
        },
      },
      {
        status: 400,
      }
    )
  }


  /*
   * Validate the final status using the existing
   * project validation schema.
   */
  const parsed = parseBody(
    deliveryStatusSchema,
    {
      status: normalizedStatus,
    }
  )

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid status',
        details: parsed.error,
      },
      {
        status: 400,
      }
    )
  }


  const status = parsed.data.status

  const deliveryStatus =
    DELIVERY_STATUS_MAP[status]

  const orderStatus =
    ORDER_STATUS_MAP[status]


  /*
   * Make sure the maps actually contain the
   * requested status.
   */
  if (!deliveryStatus || !orderStatus) {
    return NextResponse.json(
      {
        error: 'Unsupported delivery status',
        details: {
          status,
        },
      },
      {
        status: 400,
      }
    )
  }


  const admin = createAdminClient()


  /*
   * Use the atomic database function.
   *
   * This function:
   *
   * 1. Confirms the rider owns the delivery
   * 2. Locks the delivery row
   * 3. Updates delivery status
   * 4. Updates pickup/delivery timestamps
   * 5. Transitions the order
   * 6. Marks rider available after delivery
   * 7. Records rider earnings after delivery
   */
  const {
    data,
    error,
  } = await admin.rpc(
    'rider_update_delivery_status',
    {
      p_delivery_id: deliveryId,

      p_rider_user_id: user.id,

      p_delivery_status:
        deliveryStatus,

      p_order_status:
        orderStatus,
    }
  )


  /*
   * Database/RPC error handling.
   */
  if (error) {
    console.error(
      '[delivery status]',
      {
        deliveryId,
        riderUserId: user.id,
        requestedAction,
        normalizedStatus,
        deliveryStatus,
        orderStatus,
        error,
      }
    )

    const msg =
      error.message || ''


    /*
     * Delivery does not belong to this rider
     * or does not exist.
     */
    if (
      msg.includes('DELIVERY_NOT_FOUND')
    ) {
      return NextResponse.json(
        {
          error: 'Delivery not found',
        },
        {
          status: 404,
        }
      )
    }


    /*
     * Rider authorization failure.
     */
    if (
      msg.includes('FORBIDDEN')
    ) {
      return NextResponse.json(
        {
          error: 'Forbidden',
        },
        {
          status: 403,
        }
      )
    }


    /*
     * Invalid order state transition.
     *
     * Example:
     *
     * READY_FOR_PICKUP -> PICKED_UP
     *
     * instead of:
     *
     * RIDER_ASSIGNED -> PICKED_UP
     */
    if (
      msg.includes('INVALID_TRANSITION')
    ) {
      const transitionMatch =
        msg.match(
          /INVALID_TRANSITION:([^ ]+)/
        )

      return NextResponse.json(
        {
          error:
            'Invalid status transition',

          details:
            transitionMatch?.[1] ||
            msg,
        },
        {
          status: 400,
        }
      )
    }


    /*
     * Rider is not actually registered as
     * a rider.
     */
    if (
      msg.includes('FORBIDDEN_NOT_RIDER')
    ) {
      return NextResponse.json(
        {
          error: 'Rider account not found',
        },
        {
          status: 403,
        }
      )
    }


    /*
     * Order does not exist.
     */
    if (
      msg.includes('ORDER_NOT_FOUND')
    ) {
      return NextResponse.json(
        {
          error: 'Order not found',
        },
        {
          status: 404,
        }
      )
    }


    /*
     * Return the actual database message instead
     * of hiding everything behind "Could not update
     * delivery".
     *
     * This makes future debugging much easier.
     */
    return NextResponse.json(
      {
        error:
          'Could not update delivery',

        details:
          msg || 'Unknown database error',
      },
      {
        status: 400,
      }
    )
  }


  /*
   * Success.
   */
  return NextResponse.json(
    {
      message:
        `Status ${deliveryStatus}`,

      action:
        requestedAction,

      deliveryStatus,

      orderStatus,

      result: data,
    },
    {
      status: 200,
    }
  )
}
