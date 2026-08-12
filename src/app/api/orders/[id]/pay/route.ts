import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { initiateStkPush } from '@/lib/mpesa'
import { payOrderSchema, parseBody } from '@/lib/validation/schemas'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * Initiate or retry STK Push for an order.
 * Does NOT create a new order — only triggers payment for existing PENDING_PAYMENT order.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole('CUSTOMER')
  if (auth.error) return auth.error
  const { user } = auth

  const ip = clientIp(req)
  const rl = rateLimit(`stk:${user.id}:${ip}`, 5, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many payment attempts. Wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  let phone = user.phone
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = parseBody(payOrderSchema, body)
    if (parsed.success && parsed.data.phone) {
      phone = parsed.data.phone
    }
  } catch {
    /* body optional */
  }

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('id, order_number, total, status, customer_id')
    .eq('id', params.id)
    .eq('customer_id', user.customer!.id)
    .maybeSingle()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (!['PENDING_PAYMENT'].includes(order.status)) {
    return NextResponse.json(
      {
        error: `Order is ${order.status}. Payment can only be started for pending payment orders.`,
      },
      { status: 400 }
    )
  }

  // Create or reuse pending payment row
  const { data: existingPay } = await admin
    .from('payments')
    .select('id, status, checkout_request_id')
    .eq('order_id', order.id)
    .in('status', ['PENDING', 'FAILED', 'TIMEOUT', 'CANCELLED'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let paymentId = existingPay?.id
  if (!paymentId) {
    const { data: pay, error: payErr } = await admin
      .from('payments')
      .insert({
        order_id: order.id,
        amount: order.total,
        status: 'PENDING',
        method: 'MPESA_STK',
        phone,
      })
      .select('id')
      .single()
    if (payErr || !pay) {
      console.error('[pay] create payment', payErr)
      return NextResponse.json(
        { error: 'Could not create payment' },
        { status: 500 }
      )
    }
    paymentId = pay.id
  } else {
    await admin
      .from('payments')
      .update({ status: 'PENDING', phone })
      .eq('id', paymentId)
  }

  const stk = await initiateStkPush({
    phone,
    amount: order.total,
    orderId: order.id,
    accountReference: order.order_number || order.id.slice(0, 12),
    transactionDesc: `Mboga Market ${order.order_number || ''}`,
  })

  if (!stk.success) {
    await admin
      .from('payments')
      .update({ status: 'FAILED' })
      .eq('id', paymentId)
    return NextResponse.json(
      { error: stk.message || 'STK Push failed' },
      { status: 502 }
    )
  }

  if (stk.checkoutRequestId) {
    await admin
      .from('payments')
      .update({ checkout_request_id: stk.checkoutRequestId })
      .eq('id', paymentId)
  }

  return NextResponse.json({
    message: 'STK Push sent. Check your phone to complete payment.',
    paymentId,
    checkoutRequestId: stk.checkoutRequestId,
  })
}
