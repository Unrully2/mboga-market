'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function AdminCustomersPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/customers')
        if (res.status === 401 || res.status === 403) {
          router.push('/login')
          return
        }
        const data = await res.json()
        setCustomers(data.customers || [])
      } catch {
        /* ignore */
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  const filtered = search
    ? customers.filter(
        (c) =>
          c.name?.toLowerCase().includes(search.toLowerCase()) ||
          c.phone?.includes(search)
      )
    : customers

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex">
        <aside className="hidden md:flex flex-col w-56 bg-slate-900 text-white min-h-screen p-4">
          <div className="font-bold text-lg mb-8">🥬 Mboga Admin</div>
          <nav className="space-y-1 text-sm">
            <Link href="/admin" className="block px-3 py-2 rounded-lg hover:bg-slate-800">Dashboard</Link>
            <Link href="/admin/vendors" className="block px-3 py-2 rounded-lg hover:bg-slate-800">Vendors</Link>
            <Link href="/admin/orders" className="block px-3 py-2 rounded-lg hover:bg-slate-800">Orders</Link>
            <Link href="/admin/customers" className="block px-3 py-2 rounded-lg bg-slate-800">Customers</Link>
            <Link href="/admin/categories" className="block px-3 py-2 rounded-lg hover:bg-slate-800">Catalog</Link>
            <Link href="/admin/payouts" className="block px-3 py-2 rounded-lg hover:bg-slate-800">Payouts</Link>
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <h1 className="text-2xl font-bold">Customers</h1>
            <Link href="/admin" className="text-sm text-slate-500">← Dashboard</Link>
          </div>

          <input
            type="search"
            placeholder="Search by name or phone…"
            className="input mb-4 max-w-md"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {loading && <div className="h-32 bg-white animate-pulse rounded-2xl" />}

          {!loading && (
            <p className="text-sm text-slate-500 mb-3">{filtered.length} customers</p>
          )}

          <div className="space-y-2">
            {filtered.map((c) => (
              <div key={c.id} className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="font-bold">{c.name}</p>
                  <p className="text-sm text-slate-500">{c.phone}</p>
                  {c.email && <p className="text-xs text-slate-400">{c.email}</p>}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-slate-500">{c.orderCount} orders</span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      c.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {c.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-xs text-slate-400">
                    Joined {new Date(c.joinedAt).toLocaleDateString('en-KE')}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {!loading && filtered.length === 0 && (
            <div className="card p-8 text-center text-slate-500">No customers found</div>
          )}
        </main>
      </div>
    </div>
  )
}
