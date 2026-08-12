import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * Admin-only: find stuck PENDING payments older than 15 minutes
 * and mark them TIMEOUT if still PENDING; also surface payment/order mismatches.
 */
export async function POST() {
  const auth = await requireRole('ADMIN')
  if (auth.error) return auth.error

  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString()

  // Timeout old pending M-Pesa payments only (never COD / CASH_ON_DELIVERY)
  const { data: stuck } = await admin
    .from('payments')
    .select('id, order_id, status, created_at, method')
    .eq('status', 'PENDING')
    .eq('method', 'MPESA')
    .lt('created_at', cutoff)
    .limit(100)

  let timedOut = 0
  for (const pay of stuck || []) {
    await admin.from('payments').update({ status: 'TIMEOUT' }).eq('id', pay.id).eq('status', 'PENDING')
    timedOut++
  }

  // Find mismatches: payment COMPLETED but order still PENDING_PAYMENT
  const { data: mismatches } = await admin
    .from('payments')
    .select('id, order_id, status, orders!inner(id, status)')
    .eq('status', 'COMPLETED')
    .eq('orders.status', 'PENDING_PAYMENT')
    .limit(50)

  let fixed = 0
  for (const m of mismatches || []) {
    const { error } = await admin.rpc('transition_order_status', {
      p_order_id: m.order_id,
      p_new_status: 'PAYMENT_CONFIRMED',
      p_actor_user_id: auth.user.id,
      p_actor_role: 'ADMIN',
      p_note: 'Reconciled: payment was COMPLETED',
    })
    if (!error) fixed++
    else console.error('[reconcile]', error)
  }

  return NextResponse.json({
    message: 'Reconciliation complete',
    timedOut,
    mismatchesFound: (mismatches || []).length,
    mismatchesFixed: fixed,
  })
}

export async function GET() {
  const auth = await requireRole('ADMIN')
  if (auth.error) return auth.error

  const admin = createAdminClient()
  const { data: pending } = await admin
    .from('payments')
    .select('id, order_id, status, amount, created_at, checkout_request_id, method')
    .eq('status', 'PENDING')
    .eq('method', 'MPESA')
    .order('created_at', { ascending: true })
    .limit(50)

  return NextResponse.json({ pendingPayments: pending || [] })
}
