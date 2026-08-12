import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { reviewSchema, parseBody } from '@/lib/validation/schemas'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const vendorId = new URL(req.url).searchParams.get('vendorId')
  if (!vendorId) {
    return NextResponse.json({ error: 'vendorId required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('reviews')
    .select('id, vendor_rating, product_rating, comment, created_at, customer:customers(name)')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({
    reviews: (data || []).map((r: any) => ({
      id: r.id,
      vendorRating: r.vendor_rating,
      productRating: r.product_rating,
      comment: r.comment,
      customerName: r.customer?.name || 'Customer',
      createdAt: r.created_at,
    })),
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireRole('CUSTOMER')
  if (auth.error) return auth.error
  const { user } = auth

  const ip = clientIp(req)
  const rl = rateLimit(`review:${user.id}:${ip}`, 5, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many reviews. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  const body = await req.json()
  const parsed = parseBody(reviewSchema, body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid review data', details: parsed.error },
      { status: 400 }
    )
  }

  const { orderId, vendorRating, productRating, comment } = parsed.data
  const admin = createAdminClient()

  // Ownership: order must belong to this customer and be delivered/completed
  const { data: order } = await admin
    .from('orders')
    .select('id, customer_id, vendor_id, status')
    .eq('id', orderId)
    .eq('customer_id', user.customer!.id)
    .maybeSingle()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (!['DELIVERED', 'COMPLETED'].includes(order.status)) {
    return NextResponse.json(
      { error: 'You can only review delivered orders' },
      { status: 400 }
    )
  }

  const { data: existing } = await admin
    .from('reviews')
    .select('id')
    .eq('order_id', orderId)
    .eq('customer_id', user.customer!.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'You already reviewed this order' },
      { status: 409 }
    )
  }

  const { data, error } = await admin
    .from('reviews')
    .insert({
      order_id: orderId,
      customer_id: user.customer!.id,
      vendor_id: order.vendor_id,
      vendor_rating: vendorRating,
      product_rating: productRating ?? vendorRating,
      comment: comment || null,
    })
    .select()
    .single()

  if (error) {
    console.error('[review]', error)
    return NextResponse.json({ error: 'Could not save review' }, { status: 500 })
  }

  // Update vendor average rating (best-effort)
  const { data: ratings } = await admin
    .from('reviews')
    .select('vendor_rating')
    .eq('vendor_id', order.vendor_id)
  if (ratings?.length) {
    const avg =
      ratings.reduce((s: number, r: any) => s + r.vendor_rating, 0) /
      ratings.length
    await admin
      .from('vendors')
      .update({ rating: Math.round(avg * 10) / 10, total_reviews: ratings.length })
      .eq('id', order.vendor_id)
  }

  return NextResponse.json({ review: data, message: 'Thank you for your review' })
}
