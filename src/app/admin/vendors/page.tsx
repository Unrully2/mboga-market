'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

function VendorsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const statusFilter = searchParams.get('status') || ''

  const [vendors, setVendors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)

  async function load() {
    try {
      const q = statusFilter ? `?status=${statusFilter}` : ''
      const res = await fetch(`/api/admin/vendors${q}`)
      if (res.status === 401 || res.status === 403) {
        router.push('/login')
        return
      }
      const data = await res.json()
      setVendors(data.vendors || [])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [statusFilter])

  async function setStatus(vendorId: string, status: string) {
    setActionId(vendorId)
    try {
      const res = await fetch('/api/admin/vendors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorId, status }),
      })
      if (res.ok) await load()
      else {
        const d = await res.json()
        alert(d.error || 'Failed')
      }
    } catch {
      alert('Network error')
    } finally {
      setActionId(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex">
        <aside className="hidden md:flex flex-col w-56 bg-slate-900 text-white min-h-screen p-4">
          <div className="font-bold text-lg mb-8">🥬 Mboga Admin</div>
          <nav className="space-y-1 text-sm">
            <Link href="/admin" className="block px-3 py-2 rounded-lg hover:bg-slate-800">Dashboard</Link>
            <Link href="/admin/vendors" className="block px-3 py-2 rounded-lg bg-slate-800">Vendors</Link>
            <Link href="/admin/orders" className="block px-3 py-2 rounded-lg hover:bg-slate-800">Orders</Link>
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Vendors</h1>
            <Link href="/admin" className="text-sm text-slate-500">← Dashboard</Link>
          </div>

          <div className="flex gap-2 mb-4 flex-wrap">
            {['', 'PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED'].map((s) => (
              <Link
                key={s || 'all'}
                href={s ? `/admin/vendors?status=${s}` : '/admin/vendors'}
                className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                  statusFilter === s ? 'bg-primary-600 text-white' : 'bg-white text-slate-600'
                }`}
              >
                {s || 'All'}
              </Link>
            ))}
          </div>

          {loading && <div className="h-32 bg-white animate-pulse rounded-2xl" />}

          <div className="space-y-3">
            {vendors.map((v) => (
              <div key={v.id} className="card p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-lg">{v.businessName}</p>
                    <p className="text-sm text-slate-500">
                      {v.ownerName} · {v.user?.phone || v.phone}
                    </p>
                    <p className="text-xs text-slate-400">
                      {v.location} · {v._count?.products || 0} products · {v._count?.orders || 0} orders
                    </p>
                    <span
                      className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded ${
                        v.status === 'APPROVED'
                          ? 'bg-green-100 text-green-700'
                          : v.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {v.status}
                      {v.isVerified && ' · ✓ Verified'}
                    </span>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {v.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => setStatus(v.id, 'APPROVED')}
                          disabled={actionId === v.id}
                          className="bg-primary-600 text-white font-bold px-4 py-2 rounded-xl text-sm"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setStatus(v.id, 'REJECTED')}
                          disabled={actionId === v.id}
                          className="bg-slate-200 font-bold px-4 py-2 rounded-xl text-sm"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {v.status === 'APPROVED' && (
                      <button
                        onClick={() => setStatus(v.id, 'SUSPENDED')}
                        disabled={actionId === v.id}
                        className="bg-red-100 text-red-700 font-bold px-4 py-2 rounded-xl text-sm"
                      >
                        Suspend
                      </button>
                    )}
                    {v.status === 'SUSPENDED' && (
                      <button
                        onClick={() => setStatus(v.id, 'APPROVED')}
                        disabled={actionId === v.id}
                        className="bg-primary-600 text-white font-bold px-4 py-2 rounded-xl text-sm"
                      >
                        Re-activate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!loading && vendors.length === 0 && (
            <div className="card p-8 text-center text-slate-500">No vendors found</div>
          )}
        </main>
      </div>
    </div>
  )
}

export default function AdminVendorsPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading…</div>}>
      <VendorsContent />
    </Suspense>
  )
}
