'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Product {
  id: string
  name: string
  unit: string
  price: number
  stockStatus: string
  image?: string
  category?: string
}

interface Vendor {
  id: string
  businessName: string
  ownerName: string
  location: string
  rating: number
  totalReviews: number
  minOrderAmount: number
  deliveryFee: number
  isVerified: boolean
  isOpen: boolean
  description?: string
  distance: number
  estimatedTime: string
  products: Product[]
}

const PREP_OPTIONS = ['Chopped', 'Unchopped', 'Washed', 'Unwashed', 'Ripe', 'Green', 'Small pieces', 'Large pieces']

export default function VendorStorePage() {
  const params = useParams()
  const router = useRouter()
  const vendorId = params.id as string

  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [qty, setQty] = useState(1)
  const [instructions, setInstructions] = useState<string[]>([])
  const [specialNote, setSpecialNote] = useState('')
  const [isFav, setIsFav] = useState(false)
  const [favLoading, setFavLoading] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/vendors/${vendorId}?lat=-1.1714&lng=36.8356`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load')
        setVendor(data.vendor)
        // Check if favourited
        try {
          const favRes = await fetch('/api/favorites')
          if (favRes.ok) {
            const favData = await favRes.json()
            setIsFav((favData.favorites || []).some((f: any) => f.vendorId === vendorId))
          }
        } catch { /* not logged in */ }
      } catch (e: any) {
        setError(e.message || 'Could not load vendor')
      } finally {
        setLoading(false)
      }
    }
    if (vendorId) load()
  }, [vendorId])

  async function addToCart() {
    if (!selectedProduct) return
    setAdding(selectedProduct.id)
    try {
      const instr = [...instructions, specialNote].filter(Boolean).join(', ')
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorProductId: selectedProduct.id,
          quantity: qty,
          instructions: instr || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login')
          return
        }
        setToast(data.error || 'Failed to add')
      } else {
        setToast('Added to cart ✓')
        setSelectedProduct(null)
        setQty(1)
        setInstructions([])
        setSpecialNote('')
      }
    } catch {
      setToast('Network error')
    } finally {
      setAdding(null)
      setTimeout(() => setToast(''), 2500)
    }
  }

  function toggleInstr(opt: string) {
    setInstructions((prev) =>
      prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]
    )
  }

  async function toggleFav() {
    setFavLoading(true)
    try {
      if (isFav) {
        await fetch(`/api/favorites?vendorId=${vendorId}`, { method: 'DELETE' })
        setIsFav(false)
      } else {
        const res = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vendorId }),
        })
        if (res.status === 401) {
          router.push('/login')
          return
        }
        setIsFav(true)
      }
    } catch { /* ignore */ }
    finally { setFavLoading(false) }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="h-40 bg-slate-200 animate-pulse rounded-2xl mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-slate-200 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !vendor) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="card p-8 text-center">
          <p className="text-4xl mb-2">😕</p>
          <p className="font-medium">{error || 'Vendor not found'}</p>
          <Link href="/customer" className="btn-primary mt-4 inline-block">
            Back to vendors
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-30">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/customer" className="text-2xl">←</Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold truncate">{vendor.businessName}</h1>
            <p className="text-xs text-slate-500">
              ⭐ {vendor.rating.toFixed(1)} ({vendor.totalReviews}) · 📍 {vendor.distance} km · {vendor.estimatedTime}
            </p>
          </div>
          {vendor.isVerified && (
            <span className="text-[10px] bg-primary-100 text-primary-700 px-2 py-1 rounded font-semibold">
              ✓ VERIFIED
            </span>
          )}
          <button
            onClick={toggleFav}
            disabled={favLoading}
            className="text-2xl ml-1"
            aria-label="Favourite"
          >
            {isFav ? '❤️' : '🤍'}
          </button>
        </div>
      </div>

      {/* Vendor info */}
      <div className="bg-white px-4 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-14 h-14 rounded-xl bg-primary-50 flex items-center justify-center text-3xl">🥬</div>
          <div>
            <p className="text-sm text-slate-600">{vendor.location}</p>
            <p className="text-sm">
              Delivery <span className="font-semibold">KES {vendor.deliveryFee}</span>
              {' · '}Min order <span className="font-semibold">KES {vendor.minOrderAmount}</span>
            </p>
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${vendor.isOpen ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {vendor.isOpen ? 'OPEN' : 'CLOSED'}
            </span>
          </div>
        </div>
        {vendor.description && (
          <p className="text-sm text-slate-500 mt-2">{vendor.description}</p>
        )}
      </div>

      {/* Products */}
      <div className="p-4">
        <h2 className="font-bold text-lg mb-3">Products ({vendor.products.length})</h2>
        {vendor.products.length === 0 ? (
          <div className="card p-8 text-center text-slate-500">
            <p>No products available right now</p>
          </div>
        ) : (
          <div className="space-y-3">
            {vendor.products.map((p) => (
              <div key={p.id} className="card p-3 flex gap-3 items-center">
                <div className="w-14 h-14 rounded-xl bg-slate-50 flex items-center justify-center text-3xl flex-shrink-0">
                  {p.image || '🥬'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.unit}</p>
                  <p className="font-bold text-primary-600">KES {p.price}</p>
                </div>
                {p.stockStatus === 'OUT_OF_STOCK' ? (
                  <span className="text-xs text-red-500 font-medium">Out of stock</span>
                ) : (
                  <button
                    onClick={() => {
                      setSelectedProduct(p)
                      setQty(1)
                      setInstructions([])
                      setSpecialNote('')
                    }}
                    className="bg-primary-600 text-white font-bold w-10 h-10 rounded-full text-xl flex items-center justify-center active:scale-90"
                  >
                    +
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add to cart modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg">{selectedProduct.name}</h3>
                <p className="text-sm text-slate-500">{selectedProduct.unit} · KES {selectedProduct.price}</p>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="text-2xl text-slate-400">×</button>
            </div>

            {/* Quantity */}
            <div className="flex items-center justify-between mb-4">
              <span className="font-medium">Quantity</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="w-10 h-10 rounded-full border-2 border-slate-200 font-bold text-lg"
                >
                  −
                </button>
                <span className="font-bold text-lg w-8 text-center">{qty}</span>
                <button
                  onClick={() => setQty(qty + 1)}
                  className="w-10 h-10 rounded-full border-2 border-slate-200 font-bold text-lg"
                >
                  +
                </button>
              </div>
            </div>

            {/* Preparation options */}
            <p className="font-medium mb-2 text-sm">Preparation (optional)</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {PREP_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => toggleInstr(opt)}
                  className={`text-xs px-3 py-1.5 rounded-full border ${
                    instructions.includes(opt)
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>

            <textarea
              placeholder="Special instructions (e.g. Please chop the sukuma wiki)"
              className="input text-sm mb-4"
              rows={2}
              value={specialNote}
              onChange={(e) => setSpecialNote(e.target.value)}
            />

            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-bold text-lg">KES {selectedProduct.price * qty}</span>
            </div>

            <button
              onClick={addToCart}
              disabled={!!adding}
              className="btn-primary w-full text-lg"
            >
              {adding ? 'Adding…' : 'Add to Cart'}
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2 rounded-full text-sm z-50">
          {toast}
        </div>
      )}

      {/* Bottom bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 p-3 flex gap-3 z-40">
        <Link href="/customer/cart" className="btn-secondary flex-1 text-center">
          🛒 View Cart
        </Link>
        <Link href="/customer" className="btn-primary flex-1 text-center">
          More Vendors
        </Link>
      </div>
    </div>
  )
}
