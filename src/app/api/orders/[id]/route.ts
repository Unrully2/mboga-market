import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { uuidSchema } from '@/lib/validation/schemas'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const idCheck = uuidSchema.safeParse(params.id)
  if (!idCheck.success) {
    return NextResponse.json({ error: 'Invalid order id' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: order, error } = await admin
    .from('orders')
    .select(
      `*, vendor:vendors(id, business_name, phone, location), items:order_items(*), payment:payments(*), delivery:deliveries(*, rider:riders(id, name, phone)), address:addresses(*)`
    )
    .eq('id', idCheck.data)
    .maybeSingle()

  if (error || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Explicit role authorization
  if (user.role === 'CUSTOMER') {
    if (!user.customer || order.customer_id !== user.customer.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (user.role === 'VENDOR') {
    if (!user.vendor || order.vendor_id !== user.vendor.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (user.role === 'RIDER') {
    if (!user.rider) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const delivery = Array.isArray(order.delivery)
      ? order.delivery[0]
      : order.delivery
    if (!delivery || delivery.rider_id !== user.rider.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (user.role === 'ADMIN') {
    // allowed
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({
    order: {
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      paymentMethod: order.payment_method,
      subtotal: order.subtotal,
      deliveryFee: order.delivery_fee,
      serviceFee: order.service_fee,
      discount: order.discount,
      total: order.total,
      deliveryNotes: order.delivery_notes,
      createdAt: order.created_at,
      vendor: order.vendor
        ? {
            id: order.vendor.id,
            businessName: order.vendor.business_name,
            phone: order.vendor.phone,
            location: order.vendor.location,
          }
        : null,
      items: order.items || [],
      payment: order.payment,
      delivery: order.delivery,
      address: order.address,
    },
  })
}
