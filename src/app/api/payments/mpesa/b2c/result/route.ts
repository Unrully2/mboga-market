import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.MPESA_CALLBACK_SECRET
    const isProd =
      process.env.NODE_ENV === 'production' ||
      process.env.MPESA_ENV === 'production'
    if (isProd && !secret) {
      console.error('[B2C] MPESA_CALLBACK_SECRET required in production')
      return NextResponse.json(
        { error: 'Callback authentication not configured' },
        { status: 503 }
      )
    }
    if (secret) {
      const url = new URL(req.url)
      const key = req.headers.get('x-callback-key') || url.searchParams.get('key')
      if (
        !key ||
        key.length !== secret.length ||
        !timingSafeEqual(Buffer.from(key), Buffer.from(secret))
      ) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await req.json()
    const result = body?.Result
    if (!result) return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })

    const resultCode = result.ResultCode
    const originatorId = result.OriginatorConversationID || ''
    const conversationId = result.ConversationID || ''
    const admin = createAdminClient()

    // Resolve payout primarily by originator_conversation_id.
    // Only compare against UUID id when originatorId is a valid UUID.
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    let payout = null as any
    if (originatorId) {
      const { data } = await admin
        .from('vendor_payouts')
        .select('*')
        .eq('originator_conversation_id', originatorId)
        .maybeSingle()
      payout = data
      if (!payout && uuidRe.test(originatorId)) {
        const { data: byId } = await admin
          .from('vendor_payouts')
          .select('*')
          .eq('id', originatorId)
          .maybeSingle()
        payout = byId
      }
    }
    if (!payout && conversationId) {
      const { data } = await admin
        .from('vendor_payouts')
        .select('*')
        .or(`conversation_id.eq.${conversationId},mpesa_ref.eq.${conversationId}`)
        .maybeSingle()
      payout = data
    }

    if (!payout) {
      console.warn('[B2C] No payout for', originatorId, conversationId)
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
    }

    // Idempotent: already paid / processed
    if (payout.status === 'PAID' || payout.callback_processed_at) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
    }

    if (resultCode === 0 || resultCode === '0') {
      const params = result.ResultParameters?.ResultParameter || []
      const receipt =
        params.find((p: any) => p.Key === 'TransactionReceipt')?.Value ||
        params.find((p: any) => p.Key === 'TransactionID')?.Value ||
        conversationId

      await admin
        .from('vendor_payouts')
        .update({
          status: 'PAID',
          mpesa_ref: String(receipt),
          conversation_id: conversationId || payout.conversation_id,
          originator_conversation_id:
            originatorId || payout.originator_conversation_id,
          paid_at: new Date().toISOString(),
          callback_processed_at: new Date().toISOString(),
        })
        .eq('id', payout.id)
        .neq('status', 'PAID')
    } else {
      // Do not overwrite PAID
      await admin
        .from('vendor_payouts')
        .update({
          status: 'FAILED',
          callback_processed_at: new Date().toISOString(),
        })
        .eq('id', payout.id)
        .eq('status', 'PENDING')
    }
  } catch (err) {
    console.error('[B2C Result]', err)
  }
  return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
}

export async function GET() {
  return NextResponse.json({ status: 'ready' })
}
