import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { deliveryAcceptSchema, parseBody } from '@/lib/validation/schemas'

export const dynamic = 'force-dynamic'

/*
 * Shared delivery query.
 *
 * IMPORTANT:
 * This must be outside GET() because POST() also uses it.
 */
const DELIVERY_SELECT = `
  *,
  order:orders(
    *,
    vendor:vendors(
      id,
      business_name,
      owner_name,
      phone,
      location,
      estate,
      market,
      latitude,
      longitude,
      status,
      is_verified,
      rating,
      total_reviews
    ),
    customer:customers(
      id,
      name,
      phone,
      email,
      profile_image
    ),
    address:addresses(
      id,
      customer_id,
      label,
      estate,
      street,
      landmark,
      latitude,
      longitude,
      is_default
    ),
    items:order_items(
      id,
      order_id,
      vendor_product_id,
      product_name,
      unit,
      price,
      quantity,
      instructions,
      subtotal
    )
  )
`

/*
 * Convert the database structure into the structure
 * expected by the rider deliveries page.
 */
function formatDelivery(delivery: any) {
  const order = delivery?.order || {}
  const vendor = order?.vendor || {}
  const customer = order?.customer || {}
  const items = Array.isArray(order?.items)
    ? order.items
    : []

  const itemCount = items.reduce(
    (total: number, item: any) => {
      const quantity = Number(item?.quantity ?? 0)

      return total + (
        Number.isFinite(quantity)
          ? quantity
          : 0
      )
    },
    0
  )

  const orderTotal =
    order?.total !== null &&
    order?.total !== undefined
      ? Number(order.total)
      : 0

  const earnings =
    delivery?.earnings !== null &&
    delivery?.earnings !== undefined
      ? Number(delivery.earnings)
      : 0

  return {
    /*
     * Delivery IDs
     */
    id: delivery?.id,
    deliveryId: delivery?.id,

    /*
     * THIS IS THE IMPORTANT FIELD.
     *
     * The rider page calls:
     *
     * accept(d.orderId)
     *
     * so orderId must be present at the top level.
     */
    orderId:
      order?.id ||
      delivery?.order_id,

    /*
     * Order
     */
    orderNumber:
      order?.order_number || '',

    status:
      delivery?.status || 'PENDING',

    /*
     * Vendor / pickup
     */
    vendor: {
      id: vendor?.id || null,
      businessName:
        vendor?.business_name || '',
      ownerName:
        vendor?.owner_name || '',
      phone:
        vendor?.phone || '',
      location:
        vendor?.location || '',
      estate:
        vendor?.estate || '',
      market:
        vendor?.market || '',
      latitude:
        vendor?.latitude ?? null,
      longitude:
        vendor?.longitude ?? null,
      rating:
        vendor?.rating ?? 0,
    },

    /*
     * Customer
     */
    customer: {
      id:
        customer?.id ||
        order?.customer_id ||
        null,
      name:
        customer?.name || '',
      phone:
        customer?.phone || '',
      email:
        customer?.email || '',
      profileImage:
        customer?.profile_image || null,
    },

    /*
     * Delivery address
     */
    address:
      order?.address || null,

    /*
     * Order items / totals
     */
    items,

    itemCount,

    subtotal:
      order?.subtotal !== null &&
      order?.subtotal !== undefined
        ? Number(order.subtotal)
        : 0,

    deliveryFee:
      order?.delivery_fee !== null &&
      order?.delivery_fee !== undefined
        ? Number(order.delivery_fee)
        : 0,

    serviceFee:
      order?.service_fee !== null &&
      order?.service_fee !== undefined
        ? Number(order.service_fee)
        : 0,

    discount:
      order?.discount !== null &&
      order?.discount !== undefined
        ? Number(order.discount)
        : 0,

    total: orderTotal,

    /*
     * Delivery information
     */
    deliveryNotes:
      order?.delivery_notes || null,

    preferredTime:
      order?.preferred_time || null,

    paymentMethod:
      order?.payment_method || null,

    /*
     * Rider earnings
     */
    earnings,

    estimatedEarnings: earnings,

    /*
     * Timestamps
     */
    createdAt:
      delivery?.created_at ||
      order?.created_at ||
      null,

    updatedAt:
      delivery?.updated_at ||
      order?.updated_at ||
      null,

    pickedUpAt:
      delivery?.picked_up_at || null,

    deliveredAt:
      delivery?.delivered_at || null,
  }
}


/*
 * GET /api/deliveries
 *
 * Supported:
 *
 * ?type=available
 * ?type=active
 * ?type=history
 * no type = available + mine
 */
export async function GET(req: NextRequest) {
  const result = await requireRole('RIDER')

  if (result.error) {
    return result.error
  }

  const { user } = result

  const type =
    new URL(req.url).searchParams.get('type') ||
    'all'

  const admin = createAdminClient()


  /*
   * AVAILABLE DELIVERIES
   */
  if (type === 'available') {
    const {
      data,
      error,
    } = await admin
      .from('deliveries')
      .select(DELIVERY_SELECT)
      .eq('status', 'PENDING')
      .is('rider_id', null)
      .order('created_at', {
        ascending: false,
      })
      .limit(20)

    if (error) {
      console.error(
        '[deliveries available]',
        error
      )

      return NextResponse.json(
        {
          error:
            'Failed to load available deliveries',
          details: error.message,
        },
        {
          status: 500,
        }
      )
    }

    return NextResponse.json({
      deliveries:
        (data || []).map(formatDelivery),
    })
  }


  /*
   * ACTIVE DELIVERIES
   */
  if (type === 'active') {
    const {
      data,
      error,
    } = await admin
      .from('deliveries')
      .select(DELIVERY_SELECT)
      .eq(
        'rider_id',
        user.rider!.id
      )
      .in('status', [
        'ASSIGNED',
        'PICKED_UP',
        'IN_TRANSIT',
      ])
      .order('created_at', {
        ascending: false,
      })

    if (error) {
      console.error(
        '[deliveries active]',
        error
      )

      return NextResponse.json(
        {
          error:
            'Failed to load active deliveries',
          details: error.message,
        },
        {
          status: 500,
        }
      )
    }

    return NextResponse.json({
      deliveries:
        (data || []).map(formatDelivery),
    })
  }


  /*
   * DELIVERY HISTORY
   */
  if (type === 'history') {
    const {
      data,
      error,
    } = await admin
      .from('deliveries')
      .select(DELIVERY_SELECT)
      .eq(
        'rider_id',
        user.rider!.id
      )
      .eq('status', 'DELIVERED')
      .order('delivered_at', {
        ascending: false,
      })
      .limit(50)

    if (error) {
      console.error(
        '[deliveries history]',
        error
      )

      return NextResponse.json(
        {
          error:
            'Failed to load delivery history',
          details: error.message,
        },
        {
          status: 500,
        }
      )
    }

    return NextResponse.json({
      deliveries:
        (data || []).map(formatDelivery),
    })
  }


  /*
   * DEFAULT
   *
   * Return both:
   * - available deliveries
   * - rider's active deliveries
   */
  const {
    data: available,
    error: availableError,
  } = await admin
    .from('deliveries')
    .select(DELIVERY_SELECT)
    .eq('status', 'PENDING')
    .is('rider_id', null)
    .order('created_at', {
      ascending: false,
    })
    .limit(20)

  if (availableError) {
    console.error(
      '[deliveries default available]',
      availableError
    )

    return NextResponse.json(
      {
        error:
          'Failed to load available deliveries',
        details:
          availableError.message,
      },
      {
        status: 500,
      }
    )
  }


  const {
    data: mine,
    error: mineError,
  } = await admin
    .from('deliveries')
    .select(DELIVERY_SELECT)
    .eq(
      'rider_id',
      user.rider!.id
    )
    .in('status', [
      'ASSIGNED',
      'PICKED_UP',
      'IN_TRANSIT',
    ])
    .order('created_at', {
      ascending: false,
    })

  if (mineError) {
    console.error(
      '[deliveries default mine]',
      mineError
    )

    return NextResponse.json(
      {
        error:
          'Failed to load active deliveries',
        details:
          mineError.message,
      },
      {
        status: 500,
      }
    )
  }

  return NextResponse.json({
    available:
      (available || []).map(formatDelivery),

    mine:
      (mine || []).map(formatDelivery),
  })
}


/*
 * POST /api/deliveries
 *
 * Accept a delivery.
 *
 * The rider page currently sends:
 *
 * {
 *   orderId: "..."
 * }
 *
 * The API also accepts:
 *
 * {
 *   deliveryId: "..."
 * }
 */
export async function POST(req: NextRequest) {
  const result = await requireRole('RIDER')

  if (result.error) {
    return result.error
  }

  const { user } = result


  /*
   * Read JSON safely.
   */
  let raw: any

  try {
    raw = await req.json()
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
   * Validate request.
   */
  const parsed = parseBody(
    deliveryAcceptSchema,
    {
      deliveryId:
        raw?.deliveryId ||
        undefined,

      orderId:
        raw?.orderId ||
        undefined,
    }
  )

  if (!parsed.success) {
    console.error(
      '[delivery accept validation]',
      parsed.error
    )

    return NextResponse.json(
      {
        error: 'Invalid input',
        details: parsed.error,
      },
      {
        status: 400,
      }
    )
  }

  const {
    deliveryId,
    orderId,
  } = parsed.data

  const admin = createAdminClient()


  /*
   * Find a currently available delivery.
   */
  let query = admin
    .from('deliveries')
    .select('*')
    .eq('status', 'PENDING')
    .is('rider_id', null)

  if (deliveryId) {
    query = query.eq(
      'id',
      deliveryId
    )
  } else {
    query = query.eq(
      'order_id',
      orderId!
    )
  }

  const {
    data: delivery,
    error: findError,
  } = await query.maybeSingle()

  if (findError) {
    console.error(
      '[delivery accept find]',
      findError
    )

    return NextResponse.json(
      {
        error:
          'Failed to find delivery',
        details:
          findError.message,
      },
      {
        status: 500,
      }
    )
  }

  if (!delivery) {
    return NextResponse.json(
      {
        error:
          'Delivery is no longer available',
      },
      {
        status: 404,
      }
    )
  }


  /*
   * ATOMIC CLAIM
   *
   * This is deliberately:
   *
   * status = PENDING
   * rider_id IS NULL
   *
   * so two riders cannot successfully
   * claim the same delivery.
   */
  const {
    data: claimed,
    error: claimError,
  } = await admin
    .from('deliveries')
    .update({
      rider_id:
        user.rider!.id,

      status:
        'ASSIGNED',
    })
    .eq(
      'id',
      delivery.id
    )
    .eq(
      'status',
      'PENDING'
    )
    .is(
      'rider_id',
      null
    )
    .select()
    .maybeSingle()

  if (claimError) {
    console.error(
      '[delivery accept claim]',
      claimError
    )

    return NextResponse.json(
      {
        error:
          'Failed to accept delivery',
        details:
          claimError.message,
      },
      {
        status: 500,
      }
    )
  }

  if (!claimed) {
    return NextResponse.json(
      {
        error:
          'Delivery already assigned',
      },
      {
        status: 409,
      }
    )
  }


  /*
   * Update central order status.
   */
  const {
    error: rpcError,
  } = await admin.rpc(
    'transition_order_status',
    {
      p_order_id:
        delivery.order_id,

      p_new_status:
        'RIDER_ASSIGNED',

      p_actor_user_id:
        user.id,

      p_actor_role:
        'RIDER',

      p_note:
        'Rider accepted delivery',
    }
  )

  /*
   * Keep the delivery assigned even if
   * the order-status RPC fails.
   */
  if (rpcError) {
    console.error(
      '[delivery accept] transition_order_status failed',
      rpcError
    )
  }


  /*
   * Mark rider unavailable.
   */
  const {
    error: riderError,
  } = await admin
    .from('riders')
    .update({
      is_available: false,
    })
    .eq(
      'id',
      user.rider!.id
    )

  if (riderError) {
    console.error(
      '[delivery accept] rider update failed',
      riderError
    )
  }


  /*
   * Fetch the accepted delivery again
   * with all relationships.
   */
  const {
    data: acceptedDelivery,
    error: acceptedError,
  } = await admin
    .from('deliveries')
    .select(DELIVERY_SELECT)
    .eq(
      'id',
      claimed.id
    )
    .maybeSingle()

  if (acceptedError) {
    console.error(
      '[delivery accept] reload failed',
      acceptedError
    )
  }


  return NextResponse.json({
    message: 'Accepted',

    delivery:
      acceptedDelivery
        ? formatDelivery(
            acceptedDelivery
          )
        : formatDelivery(
            claimed
          ),
  })
}
