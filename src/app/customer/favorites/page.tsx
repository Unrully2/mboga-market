'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BottomNav } from '@/components/layout/BottomNav'
import { useRouter } from 'next/navigation'

export default function FavoritesPage() {
  const router = useRouter()
  const [favorites, setFavorites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const res = await fetch('/api/favorites')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      const data = await res.json()
      setFavorites(data.favorites || [])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function remove(id: string) {
    await fetch(`/api/favorites?id=${id}`, { method: 'DELETE' })
    load()
  }

  const vendorFavs = favorites.filter((f) => f.vendor)

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-white sticky top-0 border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <Link href="/customer/account" className="text-2xl">←</Link>
        <h1 className="font-bold text-lg">Favourite Vendors</h1>
      </header>

      <main className="p-4 space-y-3">
        {loading && <div className="h-20 bg-slate-200 animate-pulse rounded-2xl" />}

        {!loading && vendorFavs.length === 0 && (
          <div className="card p-10 text-center text-slate-500">
            <p className="text-4xl mb-2">❤️</p>
            <p className="font-medium">No favourites yet</p>
            <p className="text-sm mt-1 mb-4">Heart a vendor on their store page</p>
            <Link href="/customer" className="btn-primary inline-block">
              Browse vendors
            </Link>
          </div>
        )}

        {vendorFavs.map((f) => (
          <div key={f.id} className="card p-4 flex gap-3 items-center">
            <Link href={`/customer/vendor/${f.vendor.id}`} className="flex-1 flex gap-3 items-center">
              <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center text-2xl">
                🥬
              </div>
              <div>
                <p className="font-bold">{f.vendor.businessName}</p>
                <p className="text-sm text-slate-500">
                  ⭐ {f.vendor.rating?.toFixed(1)} · {f.vendor.location}
                </p>
              </div>
            </Link>
            <button
              onClick={() => remove(f.id)}
              className="text-red-500 text-sm font-medium px-2"
            >
              Remove
            </button>
          </div>
        ))}
      </main>

      <BottomNav role="CUSTOMER" />
    </div>
  )
}
