'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { BottomNav } from '@/components/layout/BottomNav'
import { useRouter } from 'next/navigation'

interface CartItem {
  id: string
  vendorProductId: string
  name: string
  unit: string
  price: number
  quantity: number
  instructions?: string
  lineTotal: number
}

interface CartGroup {
  vendor: {
    id: string
    businessName: string
    deliveryFee: number
    minOrderAmount: number
    isOpen: boolean
  }
  items: CartItem[]
  subtotal: number
}

export default function CartPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<CartGroup[]>([])
  const [subtotal, setSubtotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadCart() {
    try {
      setLoading(true)
      const res = await fetch('/api/cart')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setGroups(data.groups || [])
      setSubtotal(data.subtotal || 0)
    } catch (e: any) {
      setError(e.message || 'Failed to load cart')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCart()
  }, [])

  async function updateQty(cartItemId: string, quantity: number) {
    await fetch('/api/cart', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cartItemId, quantity }),
    })
    loadCart()
  }

  async function removeItem(cartItemId: string) {
    await fetch(`/api/cart?id=${cartItemId}`, { method: 'DELETE' })
    loadCart()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="h-8 w-32 bg-slate-200 animate-pulse rounded mb-6" />
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-slate-200 animate-pulse rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <header className="bg-white sticky top-0 z-30 border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <Link href="/customer" className="text-2xl">←</Link>
        <h1 className="font-bold text-lg">Your Cart</h1>
      </header>

      <main className="p-4 space-y-4">
        {error && (
          <div className="card p-4 text-red-600 text-center">{error}</div>
        )}

        {groups.length === 0 && !error && (
          <div className="card p-10 text-center">
            <p className="text-5xl mb-3">🛒</p>
            <p className="font-medium text-lg">Your cart is empty</p>
            <p className="text-sm text-slate-500 mt-1 mb-6">
              Browse nearby mama mbogas and add fresh produce
            </p>
            <Link href="/customer" className="btn-primary inline-block">
              Shop Fresh Produce
            </Link>
          </div>
        )}

        {groups.map((group) => {
          const delivery = group.vendor.deliveryFee || 50
          const service = 10
          const total = group.subtotal + delivery + service
          const belowMin = group.subtotal < (group.vendor.minOrderAmount || 0)

          return (
            <div key={group.vendor.id} className="card overflow-hidden">
              <div className="bg-primary-50 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-bold">{group.vendor.businessName}</p>
                  {!group.vendor.isOpen && (
                    <p className="text-xs text-red-600 font-medium">Currently closed</p>
                  )}
                </div>
                <Link
                  href={`/customer/vendor/${group.vendor.id}`}
                  className="text-sm text-primary-600 font-medium"
                >
                  Add more
                </Link>
              </div>

              <div className="divide-y divide-slate-100">
                {group.items.map((item) => (
                  <div key={item.id} className="p-4 flex gap-3">
                    <div className="flex-1">
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.unit} · KES {item.price}</p>
                      {item.instructions && (
                        <p className="text-xs text-accent-600 mt-0.5">📝 {item.instructions}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <button
                          onClick={() => updateQty(item.id, item.quantity - 1)}
                          className="w-8 h-8 rounded-full border border-slate-200 font-bold"
                        >
                          −
                        </button>
                        <span className="font-semibold w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.id, item.quantity + 1)}
                          className="w-8 h-8 rounded-full border border-slate-200 font-bold"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-xs text-red-500 ml-2"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <p className="font-bold text-primary-700">KES {item.lineTotal}</p>
                  </div>
                ))}
              </div>

              <div className="px-4 py-3 bg-slate-50 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>KES {group.subtotal}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery</span>
                  <span>KES {delivery}</span>
                </div>
                <div className="flex justify-between">
                  <span>Service fee</span>
                  <span>KES {service}</span>
                </div>
                <div className="flex justify-between font-bold text-base pt-1 border-t border-slate-200">
                  <span>Total</span>
                  <span className="text-primary-700">KES {total}</span>
                </div>
              </div>

              {belowMin && (
                <div className="px-4 py-2 bg-amber-50 text-amber-700 text-sm">
                  Minimum order is KES {group.vendor.minOrderAmount}. Add more items.
                </div>
              )}

              <div className="p-4">
                <button
                  disabled={belowMin || !group.vendor.isOpen}
                  onClick={() =>
                    router.push(`/customer/checkout?vendorId=${group.vendor.id}`)
                  }
                  className="btn-primary w-full disabled:opacity-50"
                >
                  {!group.vendor.isOpen
                    ? 'Vendor Closed'
                    : belowMin
                    ? `Min KES ${group.vendor.minOrderAmount}`
                    : `Checkout · KES ${total}`}
                </button>
              </div>
            </div>
          )
        })}
      </main>

      {/* Bottom nav */}
      <BottomNav role="CUSTOMER" />
    </div>
  )
}
