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
  const [customers, vendors, orders, riders] = await Promise.all([
    admin.from('customers').select('*', { count: 'exact', head: true }),
    admin.from('vendors').select('*', { count: 'exact', head: true }),
    admin.from('orders').select('*', { count: 'exact', head: true }),
    admin.from('riders').select('*', { count: 'exact', head: true }),
  ])
  const { count: pendingVendors } = await admin.from('vendors').select('*', { count: 'exact', head: true }).eq('status', 'PENDING')
  const { data: recentOrders } = await admin.from('orders').select('total, status').order('created_at', { ascending: false }).limit(100)
  const revenue = (recentOrders || []).filter((o: any) => ['COMPLETED', 'DELIVERED', 'PAYMENT_CONFIRMED', 'ORDER_RECEIVED'].includes(o.status)).reduce((s: number, o: any) => s + (o.total || 0), 0)
  return NextResponse.json({
    totalCustomers: customers.count || 0,
    totalVendors: vendors.count || 0,
    totalOrders: orders.count || 0,
    totalRiders: riders.count || 0,
    pendingVendors: pendingVendors || 0,
    revenue,
  })
}
