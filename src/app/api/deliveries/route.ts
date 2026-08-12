import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { deliveryAcceptSchema, parseBody } from '@/lib/validation/schemas'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const result = await requireRole('RIDER')
  if (result.error) return result.error
  const { user } = result

  const type = new URL(req.url).searchParams.get('type') || 'all'
  const admin = createAdminClient()

  const select = `*, order:orders(*, vendor:vendors(business_name, location, phone), address:addresses(*))`

  if (type === 'available') {
    const { data } = await admin
      .from('deliveries')
      .select(select)
      .eq('status', 'PENDING')
      .is('rider_id', null)
      .order('created_at', { ascending: false })
      .limit(20)
    return NextResponse.json({ deliveries: data || [] })
  }

  if (type === 'active') {
    const { data } = await admin
      .from('deliveries')
      .select(select)
      .eq('rider_id', user.rider!.id)
      .in('status', ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'])
      .order('created_at', { ascending: false })
    return NextResponse.json({ deliveries: data || [] })
  }

  if (type === 'history') {
    const { data } = await admin
      .from('deliveries')
      .select(select)
      .eq('rider_id', user.rider!.id)
      .eq('status', 'DELIVERED')
      .order('delivered_at', { ascending: false })
      .limit(50)
    return NextResponse.json({
      deliveries: (data || []).map((d: any) => ({
        ...d,
        deliveredAt: d.delivered_at,
        earnings: d.earnings,
      })),
    })
  }

  // Default: available + mine
  const { data: available } = await admin
    .from('deliveries')
    .select(select)
    .eq('status', 'PENDING')
    .is('rider_id', null)
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: mine } = await admin
    .from('deliveries')
    .select(select)
    .eq('rider_id', user.rider!.id)
    .in('status', ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'])
    .order('created_at', { ascending: false })

  return NextResponse.json({
    available: available || [],
    mine: mine || [],
  })
}

/**
 * Accept a delivery — atomic reservation.
 * Only one rider can win: UPDATE ... WHERE status=PENDING AND rider_id IS NULL
 */
export async function POST(req: NextRequest) {
  const result = await requireRole('RIDER')
  if (result.error) return result.error
  const { user } = result

  const raw = await req.json()
  const parsed = parseBody(deliveryAcceptSchema, {
    deliveryId: raw.deliveryId || undefined,
    orderId: raw.orderId || undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error }, { status: 400 })
  }
  const { deliveryId, orderId } = parsed.data

  const admin = createAdminClient()

  // Find candidate
  let q = admin.from('deliveries').select('*').eq('status', 'PENDING').is('rider_id', null)
  if (deliveryId) q = q.eq('id', deliveryId)
  else q = q.eq('order_id', orderId!)

  const { data: delivery } = await q.maybeSingle()
  if (!delivery) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  // Atomic claim
  const { data: claimed, error: claimErr } = await admin
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

  if (claimErr || !claimed) {
    return NextResponse.json(
      { error: 'Delivery already assigned' },
      { status: 409 }
    )
  }

  // Central order status transition
  const { error: rpcErr } = await admin.rpc('transition_order_status', {
    p_order_id: delivery.order_id,
    p_new_status: 'RIDER_ASSIGNED',
    p_actor_user_id: user.id,
    p_actor_role: 'RIDER',
    p_note: 'Rider accepted delivery',
  })

  if (rpcErr) {
    // Best-effort: still mark delivery assigned; log for reconciliation
    console.error('[delivery accept] transition_order_status failed', rpcErr)
  }

  await admin
    .from('riders')
    .update({ is_available: false })
    .eq('id', user.rider!.id)

  return NextResponse.json({ message: 'Accepted', delivery: claimed })
}
