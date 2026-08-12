import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { orderStatusSchema, parseBody, uuidSchema } from '@/lib/validation/schemas'
import { createNotification } from '@/lib/services/notifications'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await requireRole(['CUSTOMER', 'VENDOR', 'RIDER', 'ADMIN'])
    if (result.error) return result.error
    const { user } = result

    const idCheck = uuidSchema.safeParse(params.id)
    if (!idCheck.success) return NextResponse.json({ error: 'Invalid order id' }, { status: 400 })
    const raw = await req.json()
    const parsed = parseBody(orderStatusSchema, { status: raw.status, note: raw.note })
    if (!parsed.success) return NextResponse.json({ error: 'Invalid status', details: parsed.error }, { status: 400 })
    const { status, note } = parsed.data

    const admin = createAdminClient()
    const { data, error } = await admin.rpc('transition_order_status', {
      p_order_id: params.id,
      p_new_status: status,
      p_actor_user_id: user.id,
      p_actor_role: user.role,
      p_note: note || null,
    })

    if (error) {
      const msg = error.message || ''
      if (msg.includes('INVALID_TRANSITION')) {
        return NextResponse.json({ error: 'Invalid status transition' }, { status: 400 })
      }
      if (msg.includes('FORBIDDEN')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (msg.includes('ORDER_NOT_FOUND')) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    // Side effects outside the transaction (notifications / delivery shell)
    if (status === 'READY_FOR_PICKUP') {
      const { data: existing } = await admin
        .from('deliveries')
        .select('id')
        .eq('order_id', params.id)
        .maybeSingle()
      if (!existing) {
        await admin.from('deliveries').insert({
          order_id: params.id,
          status: 'PENDING',
          earnings: 80,
        })
      }
      const { data: riders } = await admin
        .from('riders')
        .select('user_id, phone')
        .eq('is_available', true)
        .eq('is_verified', true)
        .limit(20)
      const { data: order } = await admin
        .from('orders')
        .select('order_number, vendor:vendors(business_name)')
        .eq('id', params.id)
        .single()
      for (const r of riders || []) {
        await createNotification({
          userId: r.user_id,
          title: 'Delivery available',
          body: `Pickup ${(order as any)?.vendor?.business_name || 'vendor'} · ${(order as any)?.order_number || ''}`,
          type: 'DELIVERY',
          data: { orderId: params.id },
        })
      }
    }

    const { data: order } = await admin
      .from('orders')
      .select('order_number, customer:customers(user_id, phone)')
      .eq('id', params.id)
      .single()

    const labels: Record<string, string> = {
      VENDOR_ACCEPTED: 'Your order was accepted',
      PREPARING: 'Vendor is preparing your order',
      READY_FOR_PICKUP: 'Order ready for pickup',
      RIDER_ASSIGNED: 'A rider has been assigned',
      PICKED_UP: 'Order picked up',
      OUT_FOR_DELIVERY: 'Order is on the way',
      DELIVERED: 'Order delivered',
      REJECTED: 'Order was declined',
    }
    const cust = (order as any)?.customer
    if (labels[status] && cust?.user_id) {
      await createNotification({
        userId: cust.user_id,
        title: labels[status],
        body: `Order ${(order as any)?.order_number}`,
        type: 'ORDER',
        data: { orderId: params.id },
        sendSms: ['VENDOR_ACCEPTED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(status),
        phone: cust.phone,
      })
    }

    return NextResponse.json({ message: `Status updated to ${status}`, result: data })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
