import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { promoValidateSchema, parseBody } from '@/lib/validation/schemas'

export const dynamic = 'force-dynamic'

const PromoSchema = z.object({
  code: z.string().min(1).max(40),
  subtotal: z.number().min(0).default(0),
  deliveryFee: z.number().min(0).default(0),
})

export async function POST(req: NextRequest) {
  const auth = await requireRole('CUSTOMER')
  if (auth.error) return auth.error

  const ip = clientIp(req)
  const rl = rateLimit(`promo:${auth.user.id}:${ip}`, 15, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { valid: false, error: 'Too many promo checks. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  try {
    const body = await req.json()
    const parsed = parseBody(promoValidateSchema, {
      code: body.code,
      subtotal: Number(body.subtotal) || 0,
      deliveryFee: Number(body.deliveryFee) || 0,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { valid: false, error: 'Invalid input', details: parsed.error },
        { status: 400 }
      )
    }

    const { code, subtotal, deliveryFee } = parsed.data
    const admin = createAdminClient()
    const { data: promo } = await admin
      .from('promo_codes')
      .select('*')
      .eq('code', code.toUpperCase().trim())
      .maybeSingle()

    if (!promo || !promo.is_active) {
      return NextResponse.json({
        valid: false,
        error: 'Invalid or inactive promo code',
      })
    }

    const now = new Date()
    if (promo.starts_at && new Date(promo.starts_at) > now) {
      return NextResponse.json({ valid: false, error: 'Promo not yet active' })
    }
    if (promo.expires_at && new Date(promo.expires_at) < now) {
      return NextResponse.json({ valid: false, error: 'Promo has expired' })
    }
    if (promo.max_uses != null && promo.used_count >= promo.max_uses) {
      return NextResponse.json({
        valid: false,
        error: 'Promo usage limit reached',
      })
    }
    if (subtotal < (promo.min_order || 0)) {
      return NextResponse.json({
        valid: false,
        error: `Minimum order KES ${promo.min_order}`,
      })
    }

    let discount = 0
    if (promo.discount_type === 'FIXED') discount = promo.discount_value
    else if (promo.discount_type === 'PERCENTAGE') {
      discount = Math.round((subtotal * promo.discount_value) / 100)
    } else if (promo.discount_type === 'FREE_DELIVERY') {
      discount = deliveryFee
    }

    return NextResponse.json({
      valid: true,
      code: promo.code,
      discountType: promo.discount_type,
      discountValue: promo.discount_value,
      discount,
      minOrder: promo.min_order,
    })
  } catch (err) {
    console.error('[promo validate]', err)
    return NextResponse.json(
      { valid: false, error: 'Validation failed' },
      { status: 500 }
    )
  }
}
