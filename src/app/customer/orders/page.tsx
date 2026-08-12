'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Package } from 'lucide-react'
import { BottomNav } from '@/components/layout/BottomNav'
import { useAuth } from '@/hooks/useAuth'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { EmptyState } from '@/components/ui/EmptyState'
import { ListSkeleton } from '@/components/ui/LoadingSkeleton'

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Awaiting Payment',
  PAYMENT_CONFIRMED: 'Payment Confirmed',
  ORDER_RECEIVED: 'Order Received',
  VENDOR_ACCEPTED: 'Vendor Accepted',
  PREPARING: 'Preparing',
  READY_FOR_PICKUP: 'Ready for Pickup',
  RIDER_ASSIGNED: 'Rider Assigned',
  PICKED_UP: 'Picked Up',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
  REFUNDED: 'Refunded',
}

const STATUS_COLOR: Record<string, string> = {
  PENDING_PAYMENT: 'bg-amber-100 text-amber-800',
  PAYMENT_CONFIRMED: 'bg-blue-100 text-blue-800',
  ORDER_RECEIVED: 'bg-blue-100 text-blue-800',
  VENDOR_ACCEPTED: 'bg-indigo-100 text-indigo-800',
  PREPARING: 'bg-purple-100 text-purple-800',
  READY_FOR_PICKUP: 'bg-cyan-100 text-cyan-800',
  RIDER_ASSIGNED: 'bg-cyan-100 text-cyan-800',
  PICKED_UP: 'bg-sky-100 text-sky-800',
  OUT_FOR_DELIVERY: 'bg-sky-100 text-sky-800',
  DELIVERED: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  REJECTED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-slate-100 text-slate-800',
}

export default function CustomerOrdersPage() {
  const { user, loading: authLoading, error: authError, reload } = useAuth({
    requiredRole: 'CUSTOMER',
  })
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/orders')
        if (!res.ok) {
          setError('Could not load orders')
          return
        }
        const data = await res.json()
        setOrders(data.orders || [])
      } catch {
        setError('Network error. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 pb-24">
        <ListSkeleton count={3} />
      </div>
    )
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-slate-50">
        <ErrorBanner message={authError} onRetry={reload} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-white sticky top-0 z-30 border-b border-slate-100 px-4 py-3">
        <h1 className="font-bold text-lg text-slate-900">My Orders</h1>
      </header>

      <main className="p-4 space-y-3">
        {error && <ErrorBanner message={error} onRetry={() => window.location.reload()} />}

        {loading && <ListSkeleton count={3} />}

        {!loading && !error && orders.length === 0 && (
          <EmptyState
            icon={Package}
            title="No orders yet"
            description="When you place an order, it will show up here so you can track it."
            action={
              <Link href="/customer" className="btn-primary inline-block">
                Start shopping
              </Link>
            }
          />
        )}

        {!loading &&
          orders.map((order) => (
            <Link
              key={order.id}
              href={`/customer/orders/${order.id}`}
              className="card p-4 block active:scale-[0.99] transition hover:shadow-md"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold text-slate-900">{order.orderNumber}</p>
                  <p className="text-sm text-slate-500">
                    {order.vendor?.businessName}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    STATUS_COLOR[order.status] || 'bg-slate-100'
                  }`}
                >
                  {STATUS_LABELS[order.status] || order.status}
                </span>
              </div>
              <p className="text-sm text-slate-600">
                {order.items?.length || 0} item(s) · KES {order.total}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {new Date(order.createdAt).toLocaleString('en-KE')}
              </p>
            </Link>
          ))}
      </main>

      <BottomNav role="CUSTOMER" />
    </div>
  )
}
