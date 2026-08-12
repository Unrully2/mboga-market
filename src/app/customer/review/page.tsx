'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function StarRating({
  value,
  onChange,
  label,
}: {
  value: number
  onChange: (n: number) => void
  label: string
}) {
  return (
    <div className="mb-4">
      <p className="text-sm font-medium mb-1">{label}</p>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`text-3xl ${n <= value ? 'text-amber-400' : 'text-slate-300'}`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  )
}

function ReviewForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = searchParams.get('orderId')

  const [vendorRating, setVendorRating] = useState(5)
  const [deliveryRating, setDeliveryRating] = useState(5)
  const [qualityRating, setQualityRating] = useState(5)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!orderId) {
      setError('Missing order')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          vendorRating,
          deliveryRating,
          qualityRating,
          comment,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed')
        return
      }
      setDone(true)
      setTimeout(() => router.push('/customer/orders'), 2000)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (!orderId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="card p-8 text-center">
          <p>No order specified</p>
          <Link href="/customer/orders" className="btn-primary inline-block mt-4">
            My Orders
          </Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="card p-8 text-center">
          <p className="text-5xl mb-3">🙏</p>
          <p className="font-bold text-lg">Thank you for your review!</p>
          <p className="text-sm text-slate-500 mt-1">Redirecting…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <header className="bg-white sticky top-0 border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <Link href="/customer/orders" className="text-2xl">←</Link>
        <h1 className="font-bold text-lg">Rate your order</h1>
      </header>

      <form onSubmit={submit} className="p-4 max-w-md mx-auto">
        <div className="card p-6">
          <p className="text-center text-slate-500 mb-6">How was your order?</p>

          <StarRating label="Vendor" value={vendorRating} onChange={setVendorRating} />
          <StarRating label="Delivery" value={deliveryRating} onChange={setDeliveryRating} />
          <StarRating label="Produce quality" value={qualityRating} onChange={setQualityRating} />

          <div className="mb-4">
            <label className="text-sm font-medium">Comment (optional)</label>
            <textarea
              className="input mt-1"
              rows={3}
              placeholder="Tell us more…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg mb-4">{error}</p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Submitting…' : 'Submit Review'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading…</div>}>
      <ReviewForm />
    </Suspense>
  )
}
