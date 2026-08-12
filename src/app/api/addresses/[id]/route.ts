import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { addressUpdateSchema, parseBody, uuidSchema } from '@/lib/validation/schemas'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = await requireRole('CUSTOMER')
  if (result.error) return result.error
  const { user } = result

  const idCheck = uuidSchema.safeParse(params.id)
  if (!idCheck.success) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const raw = await req.json()
  const parsed = parseBody(addressUpdateSchema, {
    label: raw.label,
    estate: raw.estate,
    street: raw.street,
    landmark: raw.landmark,
    latitude: raw.latitude != null ? Number(raw.latitude) : undefined,
    longitude: raw.longitude != null ? Number(raw.longitude) : undefined,
    isDefault: raw.isDefault,
  })
  if (!parsed.success) return NextResponse.json({ error: 'Invalid address', details: parsed.error }, { status: 400 })
  const body = parsed.data
  const admin = createAdminClient()

  // Ownership check
  const { data: existing } = await admin
    .from('addresses')
    .select('id')
    .eq('id', params.id)
    .eq('customer_id', user.customer!.id)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (body.isDefault) {
    await admin
      .from('addresses')
      .update({ is_default: false })
      .eq('customer_id', user.customer!.id)
  }

  const patch: Record<string, unknown> = {}
  if (body.label !== undefined) patch.label = body.label
  if (body.estate !== undefined) patch.estate = body.estate
  if (body.street !== undefined) patch.street = body.street
  if (body.landmark !== undefined) patch.landmark = body.landmark
  if (body.latitude !== undefined) patch.latitude = Number(body.latitude)
  if (body.longitude !== undefined) patch.longitude = Number(body.longitude)
  if (body.isDefault !== undefined) patch.is_default = body.isDefault

  const { data } = await admin
    .from('addresses')
    .update(patch)
    .eq('id', params.id)
    .eq('customer_id', user.customer!.id)
    .select()
    .single()

  return NextResponse.json({ address: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = await requireRole('CUSTOMER')
  if (result.error) return result.error
  const { user } = result

  const admin = createAdminClient()
  await admin
    .from('addresses')
    .delete()
    .eq('id', params.id)
    .eq('customer_id', user.customer!.id)

  return NextResponse.json({ message: 'Deleted' })
}
