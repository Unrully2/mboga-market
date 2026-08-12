import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { code, subtotal } = await req.json()

    if (!code) {
      return NextResponse.json(
        { valid: false, error: 'Promo code is required' },
        { status: 400 }
      )
    }

    const currentSubtotal = Number(subtotal) || 0
    const supabase = await createClient()

    const { data: promo, error } = await supabase
      .from('promos')
      .select('*')
      .eq('code', code.toUpperCase().trim())
      .single()

    if (error || !promo) {
      return NextResponse.json(
        { valid: false, error: 'Invalid promo code' },
        { status: 404 }
      )
    }

    if (!promo.is_active) {
      return NextResponse.json(
        { valid: false, error: 'Promo code is inactive' },
        { status: 400 }
      )
    }

    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return NextResponse.json(
        { valid: false, error: 'Promo code has expired' },
        { status: 400 }
      )
    }

    if (promo.usage_limit && promo.used_count >= promo.usage_limit) {
      return NextResponse.json(
        { valid: false, error: 'Promo code usage limit reached' },
        { status: 400 }
      )
    }

    if (currentSubtotal < (promo.min_order || 0)) {
      return NextResponse.json(
        { valid: false, error: `Minimum order KES ${promo.min_order}` },
        { status: 400 }
      )
    }

    let discount = 0
    if (promo.discount_type === 'percentage') {
      discount = (currentSubtotal * promo.discount_value) / 100
      if (promo.max_discount && discount > promo.max_discount) {
        discount = promo.max_discount
      }
    } else if (promo.discount_type === 'fixed') {
      discount = promo.discount_value
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
