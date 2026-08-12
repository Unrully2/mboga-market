'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { BottomNav } from '@/components/layout/BottomNav'
import { useRouter } from 'next/navigation'

export default function VendorProductsPage() {
  const router = useRouter()
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  async function load() {
    try {
      const res = await fetch('/api/vendor/products')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      const data = await res.json()
      setProducts(data.products || [])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function toggleStock(id: string, current: string) {
    const next = current === 'IN_STOCK' ? 'OUT_OF_STOCK' : 'IN_STOCK'
    setSaving(id)
    await fetch('/api/vendor/products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: [{ id, stockStatus: next }] }),
    })
    await load()
    setSaving(null)
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-24">
      <header className="bg-primary-600 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/vendor" className="text-2xl">←</Link>
          <h1 className="text-xl font-bold">My Products</h1>
        </div>
        <Link href="/vendor/products/add" className="bg-white text-primary-700 text-sm font-bold px-3 py-1.5 rounded-lg">
          + Add
        </Link>
      </header>

      <main className="p-4 space-y-3">
        {loading && <div className="h-20 bg-white animate-pulse rounded-2xl" />}

        {!loading && products.length === 0 && (
          <div className="card p-8 text-center text-slate-500">
            <p>No products yet. Run the seed or add products from admin.</p>
          </div>
        )}

        {products.map((p) => (
          <div key={p.id} className="card p-4 flex items-center gap-3">
            <div className="flex-1">
              <p className="font-bold">{p.name}</p>
              <p className="text-sm text-slate-500">{p.unit} · KES {p.price}</p>
            </div>
            <button
              onClick={() => toggleStock(p.id, p.stockStatus)}
              disabled={saving === p.id}
              className={`px-4 py-2 rounded-xl text-sm font-bold ${
                p.stockStatus === 'IN_STOCK'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {saving === p.id
                ? '…'
                : p.stockStatus === 'IN_STOCK'
                ? 'IN STOCK'
                : 'OUT OF STOCK'}
            </button>
          </div>
        ))}
      </main>

      <BottomNav role="VENDOR" />
    </div>
  )
}
