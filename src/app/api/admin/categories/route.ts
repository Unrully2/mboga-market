import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import {
  adminCategorySchema,
  adminCategoryPatchSchema,
  parseBody,
} from '@/lib/validation/schemas'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireRole('ADMIN')
  if (auth.error) return auth.error

  const admin = createAdminClient()
  const { data } = await admin
    .from('categories')
    .select('*')
    .order('name')
  return NextResponse.json({ categories: data || [] })
}

export async function POST(req: NextRequest) {
  const auth = await requireRole('ADMIN')
  if (auth.error) return auth.error

  const raw = await req.json()
  const parsed = parseBody(adminCategorySchema, {
    name: raw.name,
    slug: raw.slug,
    isActive: raw.isActive,
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid category', details: parsed.error },
      { status: 400 }
    )
  }

  const { name, slug, isActive } = parsed.data
  const finalSlug =
    slug ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('categories')
    .insert({
      name,
      slug: finalSlug,
      is_active: isActive ?? true,
    })
    .select()
    .single()

  if (error) {
    console.error('[admin categories]', error)
    return NextResponse.json({ error: 'Could not create category' }, { status: 500 })
  }
  return NextResponse.json({ category: data, message: 'Created' })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRole('ADMIN')
  if (auth.error) return auth.error

  const raw = await req.json()
  const parsed = parseBody(adminCategoryPatchSchema, {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    isActive: raw.isActive,
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid category update', details: parsed.error },
      { status: 400 }
    )
  }

  const { id, name, slug, isActive } = parsed.data
  const patch: Record<string, unknown> = {}
  if (name !== undefined) patch.name = name
  if (slug !== undefined) patch.slug = slug
  if (isActive !== undefined) patch.is_active = isActive

  const admin = createAdminClient()
  const { data } = await admin
    .from('categories')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  return NextResponse.json({ category: data })
}
