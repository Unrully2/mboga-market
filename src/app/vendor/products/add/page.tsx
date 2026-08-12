'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function VendorAddProductPage() {
  const router = useRouter()
  const [catalog, setCatalog] = useState<any[]>([])
  const [myProductIds, setMyProductIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [cat, mine] = await Promise.all([
          fetch('/api/catalog').then((r) => r.json()),
          fetch('/api/vendor/products').then((r) => r.json()),
        ])
        if (mine.error === 'Vendor login required') {
          router.push('/login')
          return
        }
        setCatalog(cat.products || [])
        // Map existing by product name is harder; we only have vendorProduct ids.
        // For simplicity show all catalog items.
      } catch {
        /* ignore */
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  const filtered = search
    ? catalog.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : catalog

  async function addProduct() {
    if (!selected || !price) return
    setSaving(true)
    setMsg('')
    try {
      const res = await fetch('/api/vendor/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selected,
          price: Number(price),
          stockStatus: 'IN_STOCK',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg(data.error || 'Failed')
      } else {
        setMsg('Product added ✓')
        setTimeout(() => router.push('/vendor/products'), 1000)
      }
    } catch {
      setMsg('Network error')
    } finally {
      setSaving(false)
    }
  }

  const selectedProduct = catalog.find((p) => p.id === selected)

  return (
    <div className="min-h-screen bg-slate-100 pb-8">
      <header className="bg-primary-600 text-white p-4 flex items-center gap-3">
        <Link href="/vendor/products" className="text-2xl">←</Link>
        <h1 className="text-xl font-bold">Add Product</h1>
      </header>

      <main className="p-4 space-y-4">
        <input
          type="search"
          className="input"
          placeholder="Search tomatoes, sukuma, onions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading && <div className="h-20 bg-white animate-pulse rounded-2xl" />}

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setSelected(p.id)
                setPrice(String(p.basePrice || 20))
              }}
              className={`w-full card p-3 flex items-center gap-3 text-left ${
                selected === p.id ? 'border-2 border-primary-500' : ''
              }`}
            >
              <span className="text-2xl">{p.image || '🥬'}</span>
              <div>
                <p className="font-semibold">{p.name}</p>
                <p className="text-xs text-slate-500">
                  {p.unit} · suggested KES {p.basePrice}
                </p>
              </div>
            </button>
          ))}
        </div>

        {selectedProduct && (
          <div className="card p-4 space-y-3">
            <p className="font-bold">
              {selectedProduct.name}{' '}
              <span className="text-sm font-normal text-slate-500">
                ({selectedProduct.unit})
              </span>
            </p>
            <div>
              <label className="text-sm font-medium">Your price (KES)</label>
              <input
                type="number"
                min="1"
                className="input mt-1 text-lg font-bold"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            {msg && (
              <p className={`text-sm ${msg.includes('✓') ? 'text-green-600' : 'text-red-600'}`}>
                {msg}
              </p>
            )}
            <button
              onClick={addProduct}
              disabled={saving || !price}
              className="btn-primary w-full text-lg py-4"
            >
              {saving ? 'Saving…' : 'ADD TO MY STALL'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
