'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { MapPin, Search, Leaf } from 'lucide-react'
import { BottomNav } from '@/components/layout/BottomNav'
import { AccountMenu } from '@/components/layout/AccountMenu'
import { useAuth } from '@/hooks/useAuth'
import { ErrorBanner } from '@/components/ui/ErrorBanner'

interface Vendor {
  id: string
  businessName: string
  rating: number
  totalReviews: number
  distance: number
  estimatedTime: string
  deliveryFee: number
  isOpen: boolean
  isVerified: boolean
  location?: string
}

const CATEGORIES = [
  { name: 'Vegetables', icon: Leaf, slug: 'vegetables', color: 'bg-green-100 text-green-700' },
  { name: 'Fruits', icon: Leaf, slug: 'fruits', color: 'bg-red-100 text-red-700' },
  { name: 'Roots', icon: Leaf, slug: 'roots-tubers', color: 'bg-amber-100 text-amber-700' },
  { name: 'Spices', icon: Leaf, slug: 'spices', color: 'bg-orange-100 text-orange-700' },
  { name: 'Avocados', icon: Leaf, slug: 'avocado', color: 'bg-emerald-100 text-emerald-700' },
  { name: 'Bananas', icon: Leaf, slug: 'bananas', color: 'bg-yellow-100 text-yellow-700' },
]

export default function CustomerHome() {
  const { user, loading: authLoading, logout } = useAuth({ requiredRole: 'CUSTOMER' })
  const [location, setLocation] = useState('Kiambu Town')
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError('')
        let lat = -1.1714
        let lng = 36.8356
        let locLabel = 'Kiambu Town'

        try {
          const addrRes = await fetch('/api/addresses')
          if (addrRes.ok) {
            const addrData = await addrRes.json()
            const def =
              (addrData.addresses || []).find((a: any) => a.isDefault) ||
              (addrData.addresses || [])[0]
            if (def) {
              locLabel = def.estate || locLabel
              if (def.latitude && def.longitude) {
                lat = def.latitude
                lng = def.longitude
              }
            }
          }
        } catch {
          /* not logged in or no addresses */
        }

        setLocation(locLabel)

        const res = await fetch(
          `/api/vendors?lat=${lat}&lng=${lng}&radius=6&sort=nearest`
        )
        const data = await res.json()
        if (res.ok) {
          setVendors(data.vendors || [])
        } else {
          setError(data.error || 'Could not load vendors')
        }
      } catch {
        setError('Network error. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = vendors

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-white sticky top-0 z-40 border-b border-slate-100">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-slate-500">Deliver to</p>
              <button className="font-semibold text-slate-900 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-primary-600" />
                {location}
                <span className="text-primary-600 text-sm">▾</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              {!authLoading && user && (
                <AccountMenu user={user} onLogout={logout} />
              )}
            </div>
          </div>

          <Link
            href="/customer/search"
            className="flex items-center gap-2 w-full px-4 py-3 rounded-xl bg-slate-100 text-slate-500 text-sm"
          >
            <Search className="w-4 h-4" />
            Search vegetables, fruits…
          </Link>
        </div>
      </header>

      <main className="px-4 py-4 space-y-6">
        {/* Categories */}
        <section>
          <h2 className="font-semibold text-slate-900 mb-3">
            What are you looking for?
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon
              return (
                <Link
                  key={cat.slug}
                  href={`/customer/search?category=${cat.slug}`}
                  className="flex flex-col items-center gap-1.5 min-w-[72px]"
                >
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center ${cat.color}`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-medium text-slate-700 text-center">
                    {cat.name}
                  </span>
                </Link>
              )
            })}
          </div>
        </section>

        {/* Nearby vendors */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-900">Nearby vendors</h2>
            <Link
              href="/customer/search"
              className="text-sm text-primary-600 font-medium flex items-center gap-0.5"
            >
              See all <Search className="w-3.5 h-3.5" />
            </Link>
          </div>

          {error && (
            <ErrorBanner
              message={error}
              onRetry={() => window.location.reload()}
            />
          )}

          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card p-4 flex gap-3">
                  <div className="w-16 h-16 rounded-xl bg-slate-200 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 animate-pulse rounded w-3/4" />
                    <div className="h-3 bg-slate-200 animate-pulse rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="card p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-3">
                <Leaf className="w-7 h-7 text-primary-500" />
              </div>
              <p className="font-medium text-slate-800">No vendors nearby</p>
              <p className="text-sm text-slate-500 mt-1">
                Try expanding your search or check back later.
              </p>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="space-y-3">
              {filtered.map((v) => (
                <Link
                  key={v.id}
                  href={`/customer/vendor/${v.id}`}
                  className="card p-4 flex gap-3 active:scale-[0.99] transition block hover:shadow-md"
                >
                  <div className="w-16 h-16 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                    <Leaf className="w-8 h-8 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-slate-900 truncate">
                        {v.businessName}
                      </p>
                      {v.isVerified && (
                        <span className="text-[10px] bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded font-semibold flex-shrink-0">
                          VERIFIED
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-0.5">
                        <span className="text-amber-500">★</span>{' '}
                        {v.rating.toFixed(1)}
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-0.5">
                        <MapPin className="w-3 h-3" /> {v.distance} km
                      </span>
                      <span>·</span>
                      <span>{v.estimatedTime}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-slate-500">
                        From KES {v.deliveryFee} delivery
                      </span>
                      <span
                        className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                          v.isOpen
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {v.isOpen ? 'OPEN' : 'CLOSED'}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      <BottomNav role="CUSTOMER" />
    </div>
  )
}
