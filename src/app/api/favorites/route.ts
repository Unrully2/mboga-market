import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { favoriteSchema, parseBody, uuidSchema } from '@/lib/validation/schemas'

export const dynamic = 'force-dynamic'

export async function GET() {
  const result = await requireRole('CUSTOMER')
  if (result.error) return result.error
  const { user } = result

  const admin = createAdminClient()
  const { data: favorites } = await admin
    .from('favorites')
    .select('*')
    .eq('customer_id', user.customer!.id)
    .order('created_at', { ascending: false })

  const vendorIds = (favorites || [])
    .filter((f: any) => f.vendor_id)
    .map((f: any) => f.vendor_id)

  let vendors: any[] = []
  if (vendorIds.length) {
    const { data } = await admin
      .from('vendors')
      .select(
        'id, business_name, rating, is_verified, is_open, delivery_fee, location'
      )
      .in('id', vendorIds)
    vendors = data || []
  }

  const map = Object.fromEntries(vendors.map((v) => [v.id, v]))

  return NextResponse.json({
    favorites: (favorites || []).map((f: any) => ({
      id: f.id,
      vendorId: f.vendor_id,
      productId: f.product_id,
      vendor:
        f.vendor_id && map[f.vendor_id]
          ? {
              id: map[f.vendor_id].id,
              businessName: map[f.vendor_id].business_name,
              rating: map[f.vendor_id].rating,
              isVerified: map[f.vendor_id].is_verified,
              isOpen: map[f.vendor_id].is_open,
              deliveryFee: map[f.vendor_id].delivery_fee,
              location: map[f.vendor_id].location,
            }
          : null,
      createdAt: f.created_at,
    })),
  })
}

export async function POST(req: NextRequest) {
  const result = await requireRole('CUSTOMER')
  if (result.error) return result.error
  const { user } = result

  const raw = await req.json()
  const parsed = parseBody(favoriteSchema, {
    vendorId: raw.vendorId || undefined,
    productId: raw.productId || undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error }, { status: 400 })
  }
  const { vendorId, productId } = parsed.data

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('favorites')
    .select('id')
    .eq('customer_id', user.customer!.id)
    .eq('vendor_id', vendorId || null)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({
      favorite: existing,
      message: 'Already favourited',
    })
  }

  const { data } = await admin
    .from('favorites')
    .insert({
      customer_id: user.customer!.id,
      vendor_id: vendorId || null,
      product_id: productId || null,
    })
    .select()
    .single()

  return NextResponse.json({ favorite: data, message: 'Added' })
}

export async function DELETE(req: NextRequest) {
  const result = await requireRole('CUSTOMER')
  if (result.error) return result.error
  const { user } = result

  const sp = new URL(req.url).searchParams
  const id = sp.get('id')
  const vendorId = sp.get('vendorId')
  const admin = createAdminClient()

  if (id) {
    // Ownership enforced by customer_id filter
    await admin
      .from('favorites')
      .delete()
      .eq('id', id)
      .eq('customer_id', user.customer!.id)
  } else if (vendorId) {
    await admin
      .from('favorites')
      .delete()
      .eq('vendor_id', vendorId)
      .eq('customer_id', user.customer!.id)
  } else {
    return NextResponse.json(
      { error: 'id or vendorId required' },
      { status: 400 }
    )
  }

  return NextResponse.json({ message: 'Removed' })
}
