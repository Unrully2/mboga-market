import { NextRequest, NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/server'

import { requireRole } from '@/lib/auth'
import { deliveryAcceptSchema, parseBody } from '@/lib/validation/schemas'

export const dynamic = 'force-dynamic'

/**
 * Transform the database delivery structure into the structure
 * expected by the rider frontend.
 *
 * Database:
 * deliveries
 *   └── order
 *        ├── vendor
 *        ├── customer
 *        ├── address
 *        └── order_items
 *
 * Rider frontend expects:
 * {
 *   id,
 *   orderId,
 *   orderNumber,
 *   status,
 *   vendor,
 *   customer,
 *   itemCount,
 *   total,
 *   estimatedEarnings,
 *   deliveryNotes,
 *   earnings
 * }
 */
function formatDelivery(d: any) {
  const order = d?.order || {}

  const vendor = order?.vendor || {}

  const customer = order?.customer || {}

  const items = Array.isArray(order?.items) ? order.items : []

  // Count actual quantities rather than only counting item rows.
  const itemCount = items.reduce(
    (sum: number, item: any) => {
      const quantity = Number(item?.quantity ?? 0)

      return sum + (Number.isFinite(quantity) ? quantity : 0)
    },
    0
  )

  // Delivery earnings.
  // The database normally stores this on deliveries. If it is null,
  // use the project's existing default rider earning of KES 80.
  const earnings =
    d?.earnings !== null &&
    d?.earnings !== undefined &&
    Number.isFinite(Number(d.earnings))
      ? Number(d.earnings)
      : 80

  return {
    // Delivery information
    id: d?.id,
    deliveryId: d?.id,

    // IMPORTANT:
    // This is what the rider page sends back when ACCEPT is clicked.
    orderId: order?.id || d?.order_id,

    orderNumber: order?.order_number || '',

    status: d?.status || 'PENDING',

    // Vendor information expected by the rider page
    vendor: {
      id: vendor?.id || order?.vendor_id || null,
      businessName: vendor?.business_name || '',
      location: vendor?.location || '',
      phone: vendor?.phone || '',
      latitude:
        vendor?.latitude !== null &&
        vendor?.latitude !== undefined
          ? Number(vendor.latitude)
          : null,
      longitude:
        vendor?.longitude !== null &&
        vendor?.longitude !== undefined
          ? Number(vendor.longitude)
          : null,
    },

    // Customer information expected by the rider page
    customer: {
      id: customer?.id || order?.customer_id || null,
      name: customer?.name || '',
      phone: customer?.phone || '',
      email: customer?.email || '',
    },

    // Delivery address
    address: order?.address || null,

    // Order information
    itemCount,

    total:
      order?.total !== null &&
      order?.total !== undefined
        ? Number(order.total)
        : 0,

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

    // Delivery notes are stored on the order
    deliveryNotes: order?.delivery_notes || null,

    preferredTime: order?.preferred_time || null,

    paymentMethod: order?.payment_method || null,

    // Rider earnings
    earnings,

    estimatedEarnings: earnings,

    // Timestamps
    createdAt: d?.created_at || order?.created_at || null,
    updatedAt: d?.updated_at || order?.updated_at || null,

    pickedUpAt: d?.picked_up_at || null,
    deliveredAt: d?.delivered_at || null,

    // Keep the original order and delivery available if another
    // part of the application needs them.
    order,
  }
}

/**
 * GET deliveries
 *
 * Supported:
 *
 * /api/deliveries?type=available
 * /api/deliveries?type=active
 * /api/deliveries?type=history
 * /api/deliveries
 */
export async function GET(req: NextRequest) {
  const result = await requireRole('RIDER')

  if (result.error) {
    return result.error
  }

  const { user } = result

  const type =
    new URL(req.url).searchParams.get('type') || 'all'

  const admin = createAdminClient()

  /**
   * IMPORTANT:
   *
   * The old query only selected:
   *
   * order:orders(
   *   *,
   *   vendor:vendors(...),
   *   address:addresses(...)
   * )
   *
   * It did NOT select the customer or order_items.
   *
   * The rider UI needs both.
   */
  const select = `
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

  /**
   * AVAILABLE DELIVERIES
   */
  if (type === 'available') {
    const {
      data,
      error,
    } = await admin
      .from('deliveries')
      .select(select)
      .eq('status', 'PENDING')
      .is('rider_id', null)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error(
        '[deliveries GET available]',
        error
      )

      return NextResponse.json(
        {
          error: 'Failed to load available deliveries',
          details: error.message,
        },
        { status: 500 }
      )
    }

    const deliveries = (data || []).map(formatDelivery)

    return NextResponse.json({
      deliveries,
    })
  }

  /**
   * ACTIVE DELIVERIES
   */
  if (type === 'active') {
    const {
      data,
      error,
    } = await admin
      .from('deliveries')
      .select(select)
      .eq('rider_id', user.rider!.id)
      .in('status', [
        'ASSIGNED',
        'PICKED_UP',
        'IN_TRANSIT',
      ])
      .order('created_at', { ascending: false })

    if (error) {
      console.error(
        '[deliveries GET active]',
        error
      )

      return NextResponse.json(
        {
          error: 'Failed to load active deliveries',
          details: error.message,
        },
        { status: 500 }
      )
    }

    const deliveries = (data || []).map(formatDelivery)

    return NextResponse.json({
      deliveries,
    })
  }

  /**
   * DELIVERY HISTORY
   */
  if (type === 'history') {
    const {
      data,
      error,
    } = await admin
      .from('deliveries')
      .select(select)
      .eq('rider_id', user.rider!.id)
      .eq('status', 'DELIVERED')
      .order('delivered_at', {
        ascending: false,
      })
      .limit(50)

    if (error) {
      console.error(
        '[deliveries GET history]',
        error
      )

      return NextResponse.json(
        {
          error: 'Failed to load delivery history',
          details: error.message,
        },
        { status: 500 }
      )
    }

    const deliveries = (data || []).map(
      formatDelivery
    )

    return NextResponse.json({
      deliveries,
    })
  }

  /**
   * DEFAULT
   *
   * Returns:
   * available = pending jobs
   * mine = rider's active jobs
   */
  const {
    data: available,
    error: availableError,
  } = await admin
    .from('deliveries')
    .select(select)
    .eq('status', 'PENDING')
    .is('rider_id', null)
    .order('created_at', { ascending: false })
    .limit(20)

  if (availableError) {
    console.error(
      '[deliveries GET default available]',
      availableError
    )

    return NextResponse.json(
      {
        error: 'Failed to load available deliveries',
        details: availableError.message,
      },
      { status: 500 }
    )
  }

  const {
    data: mine,
    error: mineError,
  } = await admin
    .from('deliveries')
    .select(select)
    .eq('rider_id', user.rider!.id)
    .in('status', [
      'ASSIGNED',
      'PICKED_UP',
      'IN_TRANSIT',
    ])
    .order('created_at', { ascending: false })

  if (mineError) {
    console.error(
      '[deliveries GET default mine]',
      mineError
    )

    return NextResponse.json(
      {
        error: 'Failed to load active deliveries',
        details: mineError.message,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    available: (available || []).map(
      formatDelivery
    ),

    mine: (mine || []).map(
      formatDelivery
    ),
  })
}

/**
 * ACCEPT DELIVERY
 *
 * A rider can accept using:
 *
 * {
 *   orderId: "uuid"
 * }
 *
 * OR:
 *
 * {
 *   deliveryId: "uuid"
 * }
 *
 * The rider frontend currently sends orderId.
 */
export async function POST(req: NextRequest) {
  const result = await requireRole('RIDER')

  if (result.error) {
    return result.error
  }

  const { user } = result

  /**
   * Safely parse JSON.
   */
  let raw: any

  try {
    raw = await req.json()
  } catch {
    return NextResponse.json(
      {
        error: 'Invalid JSON body',
      },
      { status: 400 }
    )
  }

  /**
   * Validate either deliveryId or orderId.
   *
   * The validation schema requires a valid UUID.
   */
  const parsed = parseBody(
    deliveryAcceptSchema,
    {
      deliveryId:
        raw?.deliveryId || undefined,

      orderId:
        raw?.orderId || undefined,
    }
  )

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid input',
        details: parsed.error,
      },
      { status: 400 }
    )
  }

  const {
    deliveryId,
    orderId,
  } = parsed.data

  const admin = createAdminClient()

  /**
   * Find a still-available delivery.
   *
   * This protects against two riders trying to
   * accept the same delivery.
   */
  let query = admin
    .from('deliveries')
    .select('*')
    .eq('status', 'PENDING')
    .is('rider_id', null)

  if (deliveryId) {
    query = query.eq('id', deliveryId)
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
        error: 'Failed to find delivery',
        details: findError.message,
      },
      { status: 500 }
    )
  }

  if (!delivery) {
    return NextResponse.json(
      {
        error: 'Delivery not available',
      },
      { status: 404 }
    )
  }

  /**
   * ATOMIC CLAIM
   *
   * The important conditions are:
   *
   * id = delivery.id
   * status = PENDING
   * rider_id IS NULL
   *
   * Therefore another rider cannot successfully
   * claim the same delivery after it has already
   * been assigned.
   */
  const {
    data: claimed,
    error: claimError,
  } = await admin
    .from('deliveries')
    .update({
      rider_id: user.rider!.id,
      status: 'ASSIGNED',
    })
    .eq('id', delivery.id)
    .eq('status', 'PENDING')
    .is('rider_id', null)
    .select()
    .maybeSingle()

  if (claimError) {
    console.error(
      '[delivery accept claim]',
      claimError
    )

    return NextResponse.json(
      {
        error: 'Failed to accept delivery',
        details: claimError.message,
      },
      { status: 500 }
    )
  }

  /**
   * If no row was returned, another rider
   * probably claimed it first.
   */
  if (!claimed) {
    return NextResponse.json(
      {
        error: 'Delivery already assigned',
      },
      { status: 409 }
    )
  }

  /**
   * Update the central order state.
   */
  const {
    error: rpcError,
  } = await admin.rpc(
    'transition_order_status',
    {
      p_order_id: delivery.order_id,

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

  /**
   * Do not undo the delivery assignment if
   * the order status transition fails.
   *
   * The original project intentionally treats
   * this as best-effort.
   */
  if (rpcError) {
    console.error(
      '[delivery accept] transition_order_status failed',
      rpcError
    )
  }

  /**
   * Rider is now busy.
   */
  const {
    error: riderUpdateError,
  } = await admin
    .from('riders')
    .update({
      is_available: false,
    })
    .eq(
      'id',
      user.rider!.id
    )

  if (riderUpdateError) {
    console.error(
      '[delivery accept] rider availability update failed',
      riderUpdateError
    )
  }

  /**
   * Return the accepted delivery in the SAME
   * frontend-friendly format used by GET.
   *
   * Fetch it again with all relationships so
   * the response is immediately useful.
   */
  const {
    data: acceptedDelivery,
  } = await admin
    .from('deliveries')
    .select(select)
    .eq('id', claimed.id)
    .maybeSingle()

  return NextResponse.json({
    message: 'Accepted',

    delivery: acceptedDelivery
      ? formatDelivery(acceptedDelivery)
      : formatDelivery(claimed),
  })
}
