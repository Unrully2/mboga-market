'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function AdminOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/orders')
        if (res.status === 401 || res.status === 403) {
          router.push('/login')
          return
        }
        const data = await res.json()
        setOrders(data.orders || [])
      } catch {
        /* ignore */
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex">
        <aside className="hidden md:flex flex-col w-56 bg-slate-900 text-white min-h-screen p-4">
          <div className="font-bold text-lg mb-8">🥬 Mboga Admin</div>
          <nav className="space-y-1 text-sm">
            <Link href="/admin" className="block px-3 py-2 rounded-lg hover:bg-slate-800">Dashboard</Link>
            <Link href="/admin/vendors" className="block px-3 py-2 rounded-lg hover:bg-slate-800">Vendors</Link>
            <Link href="/admin/orders" className="block px-3 py-2 rounded-lg bg-slate-800">Orders</Link>
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Orders</h1>
            <Link href="/admin" className="text-sm text-slate-500">← Dashboard</Link>
          </div>

          {loading && <div className="h-32 bg-white animate-pulse rounded-2xl" />}

          <div className="space-y-2">
            {orders.map((o) => (
              <div key={o.id} className="card p-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <p className="font-bold">{o.orderNumber}</p>
                  <p className="text-sm text-slate-500">
                    {o.customer?.name} → {o.vendor?.businessName}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(o.createdAt).toLocaleString('en-KE')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold bg-slate-100 px-2 py-1 rounded">
                    {o.status}
                  </span>
                  <span className="font-bold text-primary-700">KES {o.total}</span>
                </div>
              </div>
            ))}
          </div>

          {!loading && orders.length === 0 && (
            <div className="card p-8 text-center text-slate-500">No orders yet</div>
          )}
        </main>
      </div>
    </div>
  )
}
