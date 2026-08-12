import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { vendorProductPatchSchema, vendorProductAddSchema, parseBody } from '@/lib/validation/schemas'

export const dynamic = 'force-dynamic'

export async function GET() {
  const result = await requireRole('VENDOR')
  if (result.error) return result.error
  const { user } = result
  if (!user.vendor) return NextResponse.json({ error: 'Vendor login required' }, { status: 401 })
  const admin = createAdminClient()
  const { data } = await admin.from('vendor_products').select(`*, product:products(name, unit, image, category:categories(name))`).eq('vendor_id', user.vendor.id).order('created_at', { ascending: false })
  return NextResponse.json({
    products: (data || []).map((vp: any) => ({
      id: vp.id, price: vp.price, stockStatus: vp.stock_status, isAvailable: vp.is_available,
      name: vp.custom_name || vp.product?.name, unit: vp.product?.unit, image: vp.image || vp.product?.image,
      category: vp.product?.category?.name, productId: vp.product_id,
    })),
  })
}

export async function PATCH(req: NextRequest) {
  const result = await requireRole('VENDOR')
  if (result.error) return result.error
  const { user } = result
  if (!user.vendor) return NextResponse.json({ error: 'Vendor login required' }, { status: 401 })
  const raw = await req.json()
  const parsed = parseBody(vendorProductPatchSchema, {
    id: raw.id,
    price: raw.price != null ? Number(raw.price) : undefined,
    stockStatus: raw.stockStatus,
    isAvailable: raw.isAvailable,
    customName: raw.customName,
  })
  if (!parsed.success) return NextResponse.json({ error: 'Invalid product', details: parsed.error }, { status: 400 })
  const { id, price, stockStatus, isAvailable, customName } = parsed.data
  const admin = createAdminClient()
  const patch: any = {}
  if (price !== undefined) patch.price = Number(price)
  if (stockStatus !== undefined) patch.stock_status = stockStatus
  if (isAvailable !== undefined) patch.is_available = isAvailable
  const { data, error } = await admin.from('vendor_products').update(patch).eq('id', id).eq('vendor_id', user.vendor.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ product: data })
}

export async function POST(req: NextRequest) {
  const result = await requireRole('VENDOR')
  if (result.error) return result.error
  const { user } = result
  if (!user.vendor) return NextResponse.json({ error: 'Vendor login required' }, { status: 401 })
  const { productId, price, stockStatus = 'IN_STOCK' } = await req.json()
  if (!productId || price === undefined) return NextResponse.json({ error: 'productId and price required' }, { status: 400 })
  const admin = createAdminClient()
  const { data: product } = await admin.from('products').select('id').eq('id', productId).maybeSingle()
  if (!product) return NextResponse.json({ error: 'Product not in catalog' }, { status: 404 })
  const { data: existing } = await admin.from('vendor_products').select('id').eq('vendor_id', user.vendor.id).eq('product_id', productId).maybeSingle()
  let vp
  if (existing) {
    const { data } = await admin.from('vendor_products').update({ price: Number(price), stock_status: stockStatus, is_available: true }).eq('id', existing.id).select().single()
    vp = data
  } else {
    const { data } = await admin.from('vendor_products').insert({ vendor_id: user.vendor.id, product_id: productId, price: Number(price), stock_status: stockStatus, is_available: true }).select().single()
    vp = data
  }
  return NextResponse.json({ product: vp, message: 'Product added' })
}
