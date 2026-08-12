import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import {
  adminProductSchema,
  adminProductPatchSchema,
  parseBody,
} from '@/lib/validation/schemas'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireRole('ADMIN')
  if (auth.error) return auth.error

  const admin = createAdminClient()
  const { data } = await admin
    .from('products')
    .select('*, category:categories(name), vendor_products(id)')
    .order('name')
  return NextResponse.json({
    products: (data || []).map((p: Record<string, unknown>) => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      basePrice: p.base_price,
      isActive: p.is_active,
      category: p.category,
      _count: {
        vendorProducts: Array.isArray(p.vendor_products)
          ? p.vendor_products.length
          : 0,
      },
    })),
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireRole('ADMIN')
  if (auth.error) return auth.error

  const raw = await req.json()
  const parsed = parseBody(adminProductSchema, {
    name: raw.name,
    unit: raw.unit,
    categoryId: raw.categoryId,
    basePrice: raw.basePrice != null ? Number(raw.basePrice) : null,
    image: raw.image || null,
    description: raw.description || null,
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid product', details: parsed.error },
      { status: 400 }
    )
  }

  const { name, unit, categoryId, basePrice, image, description } = parsed.data
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('products')
    .insert({
      name,
      slug,
      unit,
      category_id: categoryId,
      base_price: basePrice,
      image: image || null,
      description: description || null,
    })
    .select()
    .single()

  if (error) {
    console.error('[admin products]', error)
    return NextResponse.json({ error: 'Could not create product' }, { status: 500 })
  }
  return NextResponse.json({ product: data, message: 'Added' })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRole('ADMIN')
  if (auth.error) return auth.error

  const raw = await req.json()
  const parsed = parseBody(adminProductPatchSchema, {
    id: raw.id,
    name: raw.name,
    unit: raw.unit,
    basePrice: raw.basePrice != null ? Number(raw.basePrice) : undefined,
    isActive: raw.isActive,
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid product update', details: parsed.error },
      { status: 400 }
    )
  }

  const { id, name, unit, basePrice, isActive } = parsed.data
  const patch: Record<string, unknown> = {}
  if (isActive !== undefined) patch.is_active = isActive
  if (basePrice !== undefined) patch.base_price = basePrice
  if (name !== undefined) patch.name = name
  if (unit !== undefined) patch.unit = unit

  const admin = createAdminClient()
  const { data } = await admin
    .from('products')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  return NextResponse.json({ product: data })
}
