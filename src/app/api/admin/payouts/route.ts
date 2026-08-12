import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentUser, requireRole } from '@/lib/auth'
import { adminPayoutSchema, parseBody, uuidSchema } from '@/lib/validation/schemas'
import { initiateB2CPayout, createVendorPayoutRecord } from '@/lib/services/payouts'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireRole('ADMIN')
  if (auth.error) return auth.error

  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const admin = createAdminClient()
  const { data: payouts } = await admin.from('vendor_payouts').select('*, vendor:vendors(business_name, phone, mpesa_number)').order('created_at', { ascending: false }).limit(100)
  const { data: vendors } = await admin.from('vendors').select('id, business_name, phone, mpesa_number').eq('status', 'APPROVED')
  const vendorBalances = (vendors || []).map((v: any) => ({
    vendorId: v.id, businessName: v.business_name, phone: v.mpesa_number || v.phone, estimatedBalance: 0, completedOrders: 0,
  }))
  return NextResponse.json({
    payouts: (payouts || []).map((p: any) => ({
      id: p.id, amount: p.amount, status: p.status, mpesaRef: p.mpesa_ref, createdAt: p.created_at,
      vendor: p.vendor ? { businessName: p.vendor.business_name } : null,
    })),
    vendorBalances,
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireRole('ADMIN')
  if (auth.error) return auth.error
  const raw = await req.json()
  const parsed = parseBody(adminPayoutSchema, {
    vendorId: raw.vendorId,
    amount: Number(raw.amount),
    note: raw.note,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payout', details: parsed.error }, { status: 400 })
  }
  if (parsed.data.amount <= 0) {
    return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 })
  }
  const { vendorId, amount } = parsed.data
  const sendMpesa = Boolean(raw.sendMpesa)
  const admin = createAdminClient()
  const { data: vendor } = await admin.from('vendors').select('*').eq('id', vendorId).maybeSingle()
  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
  const now = new Date()
  const periodStart = new Date(now); periodStart.setDate(periodStart.getDate() - 7)
  const payout = await createVendorPayoutRecord(vendorId, Number(amount), periodStart, now)
  let mpesaResult = null
  if (sendMpesa) {
    mpesaResult = await initiateB2CPayout({
      phone: vendor.mpesa_number || vendor.phone,
      amount: Number(amount),
      remarks: `Mboga payout ${String(payout.id).slice(0, 8)}`,
      originatorConversationId: payout.id,
    })
    if (mpesaResult.success) {
      await admin.from('vendor_payouts').update({
        originator_conversation_id: mpesaResult.originatorConversationId || payout.id,
        conversation_id: mpesaResult.conversationId || null,
        mpesa_ref: mpesaResult.conversationId || null,
      }).eq('id', payout.id)
    }
  }
  return NextResponse.json({
    payout, mpesa: mpesaResult,
    message: sendMpesa ? (mpesaResult?.success ? 'Payout + B2C initiated' : `Recorded. B2C: ${mpesaResult?.message}`) : 'Payout recorded as PENDING',
  })
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const { payoutId, status, mpesaRef } = await req.json()
  if (!payoutId || !status) return NextResponse.json({ error: 'payoutId and status required' }, { status: 400 })
  const admin = createAdminClient()
  const patch: any = { status }
  if (mpesaRef) patch.mpesa_ref = mpesaRef
  if (status === 'PAID') patch.paid_at = new Date().toISOString()
  await admin.from('vendor_payouts').update(patch).eq('id', payoutId)
  return NextResponse.json({ message: `Marked ${status}` })
}
