'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function CheckoutForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const vendorId = searchParams.get('vendorId')

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [group, setGroup] = useState<any>(null)

  const [paymentMethod, setPaymentMethod] = useState<'MPESA' | 'CASH_ON_DELIVERY'>('MPESA')
  const [phone, setPhone] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [preferredTime, setPreferredTime] = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [promoDiscount, setPromoDiscount] = useState(0)
  const [promoMsg, setPromoMsg] = useState('')
  const [mpesaMsg, setMpesaMsg] = useState('')
  const [addresses, setAddresses] = useState<any[]>([])
  const [addressId, setAddressId] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/cart')
        if (res.status === 401) {
          router.push('/login')
          return
        }
        const data = await res.json()
        const g = (data.groups || []).find((x: any) => x.vendor.id === vendorId)
        if (!g) {
          setError('Cart is empty for this vendor')
        } else {
          setGroup(g)
        }
        // Pre-fill phone from session
        const me = await fetch('/api/auth/me')
        if (me.ok) {
          const u = await me.json()
          if (u.user?.phone) setPhone(u.user.phone)
        }
        // Load addresses
        const addrRes = await fetch('/api/addresses')
        if (addrRes.ok) {
          const addrData = await addrRes.json()
          const list = addrData.addresses || []
          setAddresses(list)
          const def = list.find((a: any) => a.isDefault) || list[0]
          if (def) setAddressId(def.id)
        }
      } catch {
        setError('Failed to load cart')
      } finally {
        setLoading(false)
      }
    }
    if (vendorId) load()
    else setError('No vendor selected')
  }, [vendorId, router])

  async function placeOrder() {
    if (!vendorId || !group) return
    setSubmitting(true)
    setError('')
    setMpesaMsg('')

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId,
          addressId: addressId || undefined,
          paymentMethod,
          phone: paymentMethod === 'MPESA' ? phone : undefined,
          deliveryNotes,
          preferredTime,
          promoCode: promoCode || undefined,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to place order')
        return
      }

      if (paymentMethod === 'MPESA') {
        if (data.mpesa?.success) {
          setMpesaMsg(data.mpesa.message || 'Check your phone for the M-Pesa prompt')
          // Redirect to order detail after short delay
          setTimeout(() => {
            router.push(`/customer/orders/${data.order.id}`)
          }, 3000)
        } else {
          setMpesaMsg(data.warning || data.mpesa?.message || 'M-Pesa not configured. Order saved as pending payment.')
          setTimeout(() => {
            router.push(`/customer/orders/${data.order.id}`)
          }, 3500)
        }
      } else {
        router.push(`/customer/orders/${data.order.id}`)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="h-40 bg-slate-200 animate-pulse rounded-2xl" />
      </div>
    )
  }

  if (error && !group) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="card p-8 text-center">
          <p className="font-medium mb-4">{error}</p>
          <Link href="/customer/cart" className="btn-primary inline-block">
            Back to Cart
          </Link>
        </div>
      </div>
    )
  }

  const delivery = group?.vendor?.deliveryFee || 50
  const service = 10
  const total = (group?.subtotal || 0) + delivery + service

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      <header className="bg-white sticky top-0 z-30 border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <Link href="/customer/cart" className="text-2xl">←</Link>
        <h1 className="font-bold text-lg">Checkout</h1>
      </header>

      <main className="p-4 space-y-4">
        {/* Vendor + items summary */}
        <div className="card p-4">
          <p className="font-bold mb-2">{group?.vendor?.businessName}</p>
          <div className="space-y-1 text-sm text-slate-600">
            {group?.items?.map((item: any) => (
              <div key={item.id} className="flex justify-between">
                <span>
                  {item.quantity} × {item.name}
                </span>
                <span>KES {item.lineTotal}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 mt-3 pt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>KES {group?.subtotal}</span>
            </div>
            <div className="flex justify-between">
              <span>Delivery</span>
              <span>KES {delivery}</span>
            </div>
            <div className="flex justify-between">
              <span>Service fee</span>
              <span>KES {service}</span>
            </div>
            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span className="text-primary-700">KES {total}</span>
            </div>
          </div>
        </div>

        {/* Delivery address */}
        <div className="card p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-bold">Delivery address</h2>
            <a href="/customer/addresses" className="text-sm text-primary-600 font-medium">Manage</a>
          </div>
          {addresses.length === 0 ? (
            <p className="text-sm text-slate-500">
              No saved address.{' '}
              <a href="/customer/addresses" className="text-primary-600 font-medium">Add one</a>
            </p>
          ) : (
            <div className="space-y-2">
              {addresses.map((a: any) => (
                <label key={a.id} className="flex items-start gap-3 p-3 border rounded-xl cursor-pointer">
                  <input
                    type="radio"
                    name="address"
                    checked={addressId === a.id}
                    onChange={() => setAddressId(a.id)}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-semibold text-sm">{a.label}{a.isDefault ? ' (Default)' : ''}</p>
                    <p className="text-xs text-slate-500">{a.estate}{a.street ? `, ${a.street}` : ''}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Delivery notes */}
        <div className="card p-4 space-y-3">
          <h2 className="font-bold">Delivery details</h2>
          <div>
            <label className="text-sm font-medium">Delivery notes</label>
            <textarea
              className="input mt-1"
              rows={2}
              placeholder="e.g. Gate 3, call on arrival"
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Preferred time (optional)</label>
            <input
              className="input mt-1"
              placeholder="e.g. After 5pm"
              value={preferredTime}
              onChange={(e) => setPreferredTime(e.target.value)}
            />
          </div>
        </div>

        {/* Promo */}
        <div className="card p-4 space-y-2">
          <label className="text-sm font-medium">Promo code</label>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="e.g. MBOGA50"
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value.toUpperCase())
                setPromoDiscount(0)
                setPromoMsg('')
              }}
            />
            <button
              type="button"
              className="btn-secondary px-4"
              onClick={async () => {
                if (!promoCode || !group) return
                const res = await fetch('/api/promos/validate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    code: promoCode,
                    subtotal: group.subtotal,
                    deliveryFee: group.vendor?.deliveryFee || 50,
                  }),
                })
                const data = await res.json()
                if (data.valid) {
                  setPromoDiscount(data.discount || 0)
                  setPromoMsg(data.message || 'Applied')
                } else {
                  setPromoDiscount(0)
                  setPromoMsg(data.error || 'Invalid code')
                }
              }}
            >
              Apply
            </button>
          </div>
          {promoMsg && (
            <p className={`text-sm ${promoDiscount > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {promoMsg}
            </p>
          )}
        </div>

        {/* Payment method */}
        <div className="card p-4 space-y-3">
          <h2 className="font-bold">Payment</h2>
          <label className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer">
            <input
              type="radio"
              name="pay"
              checked={paymentMethod === 'MPESA'}
              onChange={() => setPaymentMethod('MPESA')}
            />
            <div>
              <p className="font-semibold">M-Pesa</p>
              <p className="text-xs text-slate-500">Pay with STK Push on your phone</p>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer">
            <input
              type="radio"
              name="pay"
              checked={paymentMethod === 'CASH_ON_DELIVERY'}
              onChange={() => setPaymentMethod('CASH_ON_DELIVERY')}
            />
            <div>
              <p className="font-semibold">Cash on Delivery</p>
              <p className="text-xs text-slate-500">Pay the rider when you receive</p>
            </div>
          </label>

          {paymentMethod === 'MPESA' && (
            <div>
              <label className="text-sm font-medium">M-Pesa phone number</label>
              <input
                type="tel"
                className="input mt-1"
                placeholder="0712 345 678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm">{error}</div>
        )}
        {mpesaMsg && (
          <div className="bg-green-50 text-green-800 p-3 rounded-xl text-sm">{mpesaMsg}</div>
        )}
      </main>

      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 p-4 z-40">
        <button
          onClick={placeOrder}
          disabled={submitting || (paymentMethod === 'MPESA' && !phone)}
          className="btn-primary w-full text-lg disabled:opacity-50"
        >
          {submitting
            ? 'Placing order…'
            : paymentMethod === 'MPESA'
            ? `Pay KES ${total} with M-Pesa`
            : `Place Order · KES ${total}`}
        </button>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading checkout…</div>}>
      <CheckoutForm />
    </Suspense>
  )
}
