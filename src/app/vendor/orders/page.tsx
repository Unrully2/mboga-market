'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { BottomNav } from '@/components/layout/BottomNav'
import { useRouter } from 'next/navigation'

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Awaiting Payment',
  PAYMENT_CONFIRMED: 'Paid',
  ORDER_RECEIVED: 'New Order',
  VENDOR_ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY_FOR_PICKUP: 'Ready',
  RIDER_ASSIGNED: 'Rider Assigned',
  PICKED_UP: 'Picked Up',
  OUT_FOR_DELIVERY: 'On the way',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
}

export default function VendorOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [filter, setFilter] = useState<'active' | 'all'>('active')

  async function load() {
    try {
      const res = await fetch('/api/orders')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      const data = await res.json()
      setOrders(data.orders || [])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 12000) // poll for new orders
    return () => clearInterval(t)
  }, [])

  async function updateStatus(orderId: string, status: string) {
    setActionLoading(orderId)
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        await load()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed')
      }
    } catch {
      alert('Network error')
    } finally {
      setActionLoading(null)
    }
  }

  const activeStatuses = [
    'ORDER_RECEIVED',
    'PAYMENT_CONFIRMED',
    'VENDOR_ACCEPTED',
    'PREPARING',
    'READY_FOR_PICKUP',
  ]

  const filtered =
    filter === 'active'
      ? orders.filter((o) => activeStatuses.includes(o.status))
      : orders

  const newOrders = orders.filter((o) =>
    ['ORDER_RECEIVED', 'PAYMENT_CONFIRMED'].includes(o.status)
  )

  return (
    <div className="min-h-screen bg-slate-100 pb-24">
      <header className="bg-primary-600 text-white p-4">
        <div className="flex items-center gap-3">
          <Link href="/vendor" className="text-2xl">←</Link>
          <div>
            <h1 className="text-xl font-bold">Orders</h1>
            <p className="text-primary-100 text-sm">
              {newOrders.length > 0 ? `${newOrders.length} new` : 'No new orders'}
            </p>
          </div>
        </div>
      </header>

      <div className="p-4 flex gap-2">
        <button
          onClick={() => setFilter('active')}
          className={`px-4 py-2 rounded-full text-sm font-semibold ${
            filter === 'active' ? 'bg-primary-600 text-white' : 'bg-white text-slate-600'
          }`}
        >
          Active
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-full text-sm font-semibold ${
            filter === 'all' ? 'bg-primary-600 text-white' : 'bg-white text-slate-600'
          }`}
        >
          All
        </button>
      </div>

      <main className="px-4 space-y-4">
        {loading && (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-40 bg-white animate-pulse rounded-2xl" />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="card p-10 text-center">
            <p className="text-5xl mb-3">🛒</p>
            <p className="font-medium text-lg">No orders</p>
            <p className="text-sm text-slate-500 mt-1">New orders will appear here</p>
          </div>
        )}

        {filtered.map((order) => {
          const isNew = ['ORDER_RECEIVED', 'PAYMENT_CONFIRMED'].includes(order.status)
          const isAccepted = order.status === 'VENDOR_ACCEPTED'
          const isPreparing = order.status === 'PREPARING'

          return (
            <div
              key={order.id}
              className={`card overflow-hidden ${isNew ? 'border-2 border-accent-400' : ''}`}
            >
              {isNew && (
                <div className="bg-accent-500 text-white text-center py-1.5 text-sm font-bold">
                  🔔 NEW ORDER
                </div>
              )}
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-bold text-lg">{order.orderNumber}</p>
                    <p className="text-sm text-slate-500">
                      {order.customer?.name} · {order.customer?.phone}
                    </p>
                  </div>
                  <span className="text-xs font-semibold bg-slate-100 px-2 py-1 rounded">
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 mb-3 text-sm space-y-1">
                  {order.items?.map((item: any) => (
                    <div key={item.id} className="flex justify-between">
                      <span>
                        <strong>{item.quantity} ×</strong> {item.productName}
                        {item.instructions && (
                          <span className="block text-xs text-accent-600 ml-4">
                            📝 {item.instructions}
                          </span>
                        )}
                      </span>
                      <span>KES {item.subtotal}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-slate-500">
                    {order.paymentMethod === 'MPESA' ? 'M-Pesa' : 'Cash'} ·{' '}
                    {order.payment?.status || '—'}
                  </span>
                  <span className="font-bold text-xl text-primary-700">KES {order.total}</span>
                </div>

                {/* Action buttons - large for mama mbogas */}
                {isNew && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => updateStatus(order.id, 'VENDOR_ACCEPTED')}
                      disabled={actionLoading === order.id}
                      className="flex-1 bg-primary-600 text-white font-bold py-4 rounded-xl text-lg active:scale-95"
                    >
                      {actionLoading === order.id ? '…' : 'ACCEPT ORDER'}
                    </button>
                    <button
                      onClick={() => updateStatus(order.id, 'REJECTED')}
                      disabled={actionLoading === order.id}
                      className="flex-1 bg-slate-200 text-slate-700 font-bold py-4 rounded-xl text-lg active:scale-95"
                    >
                      DECLINE
                    </button>
                  </div>
                )}

                {isAccepted && (
                  <button
                    onClick={() => updateStatus(order.id, 'PREPARING')}
                    disabled={actionLoading === order.id}
                    className="w-full bg-primary-600 text-white font-bold py-4 rounded-xl text-lg"
                  >
                    START PREPARING
                  </button>
                )}

                {isPreparing && (
                  <button
                    onClick={() => updateStatus(order.id, 'READY_FOR_PICKUP')}
                    disabled={actionLoading === order.id}
                    className="w-full bg-accent-500 text-white font-bold py-4 rounded-xl text-lg"
                  >
                    READY FOR PICKUP
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </main>

      <BottomNav role="VENDOR" />
    </div>
  )
}
