'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { AdminShell } from '@/components/layout/AdminShell'
import { ListSkeleton } from '@/components/ui/LoadingSkeleton'
import { ErrorBanner } from '@/components/ui/ErrorBanner'

export default function AdminDashboard() {
  const { user, loading: authLoading, error: authError, logout, reload } = useAuth({
    requiredRole: 'ADMIN',
  })
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/stats')
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <ListSkeleton count={4} />
      </div>
    )
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-slate-100">
        <ErrorBanner message={authError} onRetry={reload} />
      </div>
    )
  }

  const cards = [
    { label: 'Customers', value: stats?.totalCustomers, color: 'text-blue-600' },
    { label: 'Active Vendors', value: stats?.activeVendors, color: 'text-primary-600' },
    { label: 'Pending Vendors', value: stats?.pendingVendors, color: 'text-amber-600' },
    { label: 'Riders', value: stats?.activeRiders, color: 'text-slate-700' },
    { label: 'Orders Today', value: stats?.ordersToday, color: 'text-indigo-600' },
    { label: 'Completed Today', value: stats?.completedToday, color: 'text-green-600' },
    { label: 'Pending Orders', value: stats?.pendingOrders, color: 'text-accent-500' },
    {
      label: 'Sales Today',
      value: stats ? `KES ${stats.salesToday}` : '—',
      color: 'text-green-700',
    },
  ]

  return (
    <AdminShell user={user} onLogout={logout} title="Dashboard">
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-24 bg-white animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cards.map((c) => (
            <div key={c.label} className="card p-4">
              <p className="text-xs text-slate-500">{c.label}</p>
              <p className={`text-2xl font-bold mt-1 ${c.color}`}>
                {c.value ?? '—'}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 grid md:grid-cols-2 gap-4">
        <Link
          href="/admin/vendors?status=PENDING"
          className="card p-6 hover:shadow-md transition"
        >
          <p className="font-bold text-lg">Pending Vendor Approvals</p>
          <p className="text-3xl font-bold text-amber-600 mt-2">
            {stats?.pendingVendors ?? 0}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            Review & approve mama mbogas
          </p>
        </Link>
        <Link href="/admin/orders" className="card p-6 hover:shadow-md transition">
          <p className="font-bold text-lg">All Orders</p>
          <p className="text-sm text-slate-500 mt-2">
            View and manage platform orders
          </p>
        </Link>
      </div>
    </AdminShell>
  )
}
