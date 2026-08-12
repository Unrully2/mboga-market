'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { BottomNav } from '@/components/layout/BottomNav'

export default function SearchPage() {
  const [q, setQ] = useState('')
  const [vendors, setVendors] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) {
        setVendors([])
        return
      }
      setLoading(true)
      try {
        const res = await fetch(
          `/api/vendors?q=${encodeURIComponent(q)}&lat=-1.1714&lng=36.8356&radius=10`
        )
        const data = await res.json()
        setVendors(data.vendors || [])
      } catch {
        setVendors([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white sticky top-0 z-30 border-b border-slate-100 px-4 py-3">
        <input
          autoFocus
          className="input"
          placeholder="Search vendors, e.g. Mama Jane, sukuma…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </header>
      <main className="p-4 space-y-3">
        {loading && <p className="text-sm text-slate-500">Searching…</p>}
        {!loading && q && vendors.length === 0 && (
          <p className="text-center text-slate-500 py-8">No vendors found</p>
        )}
        {vendors.map((v) => (
          <Link
            key={v.id}
            href={`/customer/vendor/${v.id}`}
            className="card p-4 block"
          >
            <p className="font-bold">{v.businessName}</p>
            <p className="text-sm text-slate-500">
              ⭐ {v.rating?.toFixed?.(1)} · {v.distance} km · KES {v.deliveryFee} delivery
            </p>
          </Link>
        ))}
      </main>
      <BottomNav role="CUSTOMER" />
    </div>
  )
}
