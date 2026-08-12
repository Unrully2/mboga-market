import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { handleStkCallback } from '@/lib/mpesa'

export const dynamic = 'force-dynamic'

/**
 * M-Pesa STK callback.
 * Fail closed in production: MPESA_CALLBACK_SECRET is required.
 * Accept secret via header `x-callback-key` (preferred) or query `?key=` (legacy).
 */
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.MPESA_CALLBACK_SECRET
    const isProd =
      process.env.NODE_ENV === 'production' ||
      process.env.MPESA_ENV === 'production'

    if (isProd && !secret) {
      console.error(
        '[STK Callback] MPESA_CALLBACK_SECRET is required in production'
      )
      return NextResponse.json(
        { error: 'Callback authentication not configured' },
        { status: 503 }
      )
    }

    if (secret) {
      const url = new URL(req.url)
      const key =
        req.headers.get('x-callback-key') || url.searchParams.get('key')
      if (
        !key ||
        key.length !== secret.length ||
        !timingSafeEqual(Buffer.from(key), Buffer.from(secret))
      ) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await req.json()
    await handleStkCallback(body)
  } catch (err) {
    console.error('[STK Callback]', err)
  }
  // Always acknowledge to Safaricom so they don't retry endlessly on our errors
  return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
}

export async function GET() {
  return NextResponse.json({ status: 'M-Pesa STK callback ready' })
}
