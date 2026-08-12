'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function MorningUpdatePage() {
  const router = useRouter()
  const [products, setProducts] = useState<any[]>([])
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/vendor/products')
        if (res.status === 401) {
          router.push('/login')
          return
        }
        const data = await res.json()
        const list = data.products || []
        setProducts(list)
        const map: Record<string, string> = {}
        list.forEach((p: any) => {
          map[p.id] = String(p.price)
        })
        setPrices(map)
      } catch {
        /* ignore */
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  async function saveAll() {
    setSaving(true)
    setSaved(false)
    try {
      const updates = products.map((p) => ({
        id: p.id,
        price: Number(prices[p.id]) || p.price,
      }))
      await fetch('/api/vendor/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      alert('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-32">
      <header className="bg-accent-500 text-white p-4">
        <div className="flex items-center gap-3">
          <Link href="/vendor" className="text-2xl">←</Link>
          <div>
            <p className="text-accent-100 text-sm">Good morning 👋</p>
            <h1 className="text-xl font-bold">Update today&apos;s prices</h1>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-3">
        <p className="text-sm text-slate-600 mb-2">
          Quickly set prices for today. Takes less than 30 seconds.
        </p>

        {loading && <div className="h-20 bg-white animate-pulse rounded-2xl" />}

        {products.map((p) => (
          <div key={p.id} className="card p-4 flex items-center gap-3">
            <div className="flex-1">
              <p className="font-bold">{p.name}</p>
              <p className="text-xs text-slate-500">{p.unit}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-500">KES</span>
              <input
                type="number"
                min="1"
                className="w-20 input text-center font-bold text-lg py-2"
                value={prices[p.id] ?? ''}
                onChange={(e) =>
                  setPrices((prev) => ({ ...prev, [p.id]: e.target.value }))
                }
              />
            </div>
          </div>
        ))}
      </main>

      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 p-4 z-40">
        <button
          onClick={saveAll}
          disabled={saving || products.length === 0}
          className="btn-accent w-full text-lg py-4"
        >
          {saving ? 'Saving…' : saved ? '✓ Prices Saved' : "SAVE TODAY'S PRICES"}
        </button>
      </div>
    </div>
  )
}
