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
    const originatorId =
      body?.OriginatorConversationID || body?.Result?.OriginatorConversationID || ''
    const conversationId = body?.ConversationID || body?.Result?.ConversationID || ''
    const admin = createAdminClient()

    // Timeout must NOT overwrite already PAID payouts.
    // Prefer originator_conversation_id; only use id when value is a valid UUID.
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (originatorId) {
      await admin
        .from('vendor_payouts')
        .update({ status: 'FAILED' })
        .eq('originator_conversation_id', originatorId)
        .eq('status', 'PENDING')
      if (uuidRe.test(originatorId)) {
        await admin
          .from('vendor_payouts')
          .update({ status: 'FAILED' })
          .eq('id', originatorId)
          .eq('status', 'PENDING')
      }
    }
    if (conversationId) {
      await admin
        .from('vendor_payouts')
        .update({ status: 'FAILED' })
        .or(`conversation_id.eq.${conversationId},mpesa_ref.eq.${conversationId}`)
        .eq('status', 'PENDING')
    }
  } catch (err) {
    console.error('[B2C Timeout]', err)
  }
  return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
}

export async function GET() {
  return NextResponse.json({ status: 'ready' })
}
