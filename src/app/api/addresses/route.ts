import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { addressSchema, parseBody } from '@/lib/validation/schemas'

export const dynamic = 'force-dynamic'

export async function GET() {
  const result = await requireRole('CUSTOMER')
  if (result.error) return result.error
  const { user } = result

  const admin = createAdminClient()
  const { data } = await admin
    .from('addresses')
    .select('*')
    .eq('customer_id', user.customer!.id)
    .order('is_default', { ascending: false })

  return NextResponse.json({
    addresses: (data || []).map((a: any) => ({
      id: a.id,
      label: a.label,
      estate: a.estate,
      street: a.street,
      landmark: a.landmark,
      latitude: a.latitude,
      longitude: a.longitude,
      isDefault: a.is_default,
      createdAt: a.created_at,
    })),
  })
}

export async function POST(req: NextRequest) {
  const result = await requireRole('CUSTOMER')
  if (result.error) return result.error
  const { user } = result

  const raw = await req.json()
  const parsed = parseBody(addressSchema, {
    label: raw.label,
    estate: raw.estate,
    street: raw.street,
    landmark: raw.landmark,
    latitude: raw.latitude != null ? Number(raw.latitude) : null,
    longitude: raw.longitude != null ? Number(raw.longitude) : null,
    isDefault: raw.isDefault,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid address', details: parsed.error }, { status: 400 })
  }
  const body = parsed.data

  const admin = createAdminClient()
  if (body.isDefault) {
    await admin
      .from('addresses')
      .update({ is_default: false })
      .eq('customer_id', user.customer!.id)
  }

  const { count } = await admin
    .from('addresses')
    .select('*', { count: 'exact', head: true })
    .eq('customer_id', user.customer!.id)

  const { data, error } = await admin
    .from('addresses')
    .insert({
      customer_id: user.customer!.id,
      label: body.label,
      estate: body.estate,
      street: body.street || null,
      landmark: body.landmark || null,
      latitude: body.latitude ? Number(body.latitude) : null,
      longitude: body.longitude ? Number(body.longitude) : null,
      is_default: body.isDefault || count === 0,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ address: data, message: 'Address saved' })
}
