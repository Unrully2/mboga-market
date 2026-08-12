import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireRole('ADMIN')
  if (auth.error) return auth.error

  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const admin = createAdminClient()
  const { data } = await admin.from('customers').select('*, profiles:user_id(is_active, created_at)').order('created_at', { ascending: false }).limit(200)
  return NextResponse.json({
    customers: (data || []).map((c: any) => ({
      id: c.id, name: c.name, phone: c.phone, email: c.email,
      isActive: c.profiles?.is_active ?? true, joinedAt: c.profiles?.created_at || c.created_at, orderCount: 0,
    })),
    count: data?.length || 0,
  })
}
