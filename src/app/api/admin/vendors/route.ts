import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { requireRole } from '@/lib/auth'
import { adminVendorStatusSchema, parseBody, uuidSchema } from '@/lib/validation/schemas'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireRole('ADMIN')
  if (auth.error) return auth.error

  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const admin = createAdminClient()
  const { data } = await admin.from('vendors').select('*').order('created_at', { ascending: false }).limit(100)
  return NextResponse.json({
    vendors: (data || []).map((v: any) => ({
      id: v.id, businessName: v.business_name, ownerName: v.owner_name, phone: v.phone,
      location: v.location, status: v.status, isVerified: v.is_verified, isOpen: v.is_open,
      rating: v.rating, createdAt: v.created_at,
    })),
  })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRole('ADMIN')
  if (auth.error) return auth.error
  const raw = await req.json()
  const idCheck = uuidSchema.safeParse(raw.id || raw.vendorId)
  if (!idCheck.success) return NextResponse.json({ error: 'Valid vendor id required' }, { status: 400 })
  if (raw.status) {
    const parsed = parseBody(adminVendorStatusSchema, {
      vendorId: idCheck.data,
      status: raw.status,
    })
    if (!parsed.success) return NextResponse.json({ error: 'Invalid status', details: parsed.error }, { status: 400 })
  }
  const admin = createAdminClient()
  const patch: Record<string, unknown> = {}
  if (raw.status) patch.status = raw.status
  if (raw.isVerified !== undefined) patch.is_verified = Boolean(raw.isVerified)
  if (raw.status === 'APPROVED') patch.is_verified = true
  await admin.from('vendors').update(patch).eq('id', idCheck.data)
  return NextResponse.json({ message: 'Updated' })
}
