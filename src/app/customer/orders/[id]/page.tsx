'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { OrderTimeline } from '@/components/ui/OrderTimeline'
import { useToast } from '@/components/ui/Toast'
import { ArrowLeft } from 'lucide-react'

const STEPS = [
  'PENDING_PAYMENT',
  'PAYMENT_CONFIRMED',
  'ORDER_RECEIVED',
  'VENDOR_ACCEPTED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'RIDER_ASSIGNED',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'COMPLETED',
]

const LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Awaiting Payment',
  PAYMENT_CONFIRMED: 'Payment Confirmed',
  ORDER_RECEIVED: 'Order Received',
  VENDOR_ACCEPTED: 'Accepted by Vendor',
  PREPARING: 'Preparing',
  READY_FOR_PICKUP: 'Ready for Pickup',
  RIDER_ASSIGNED: 'Rider Assigned',
  PICKED_UP: 'Picked Up',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
}

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [riderLoc, setRiderLoc] = useState<any>(null)
  const { toast } = useToast()
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/orders/${params.id}`)
        if (res.status === 401) {
          router.push('/login')
          return
        }
        if (res.status === 404 || res.status === 403) {
          setOrder(null)
          return
        }
        const data = await res.json()
        const found = data.order || null
        setOrder(found)
        if (found && ['RIDER_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY'].includes(found.status)) {
          fetch(`/api/rider/location?orderId=${found.id}`)
            .then((r) => r.json())
            .then((d) => { if (!d.error) setRiderLoc(d) })
            .catch(() => {})
        } else {
          setRiderLoc(null)
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false)
      }
    }
    load()
    // Poll every 15s for status updates
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [params.id, router])

  if (loading) {
    return <div className="min-h-screen bg-slate-50 p-4"><div className="h-64 bg-slate-200 animate-pulse rounded-2xl" /></div>
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="card p-8 text-center">
          <p className="font-medium mb-4">Order not found</p>
          <Link href="/customer/orders" className="btn-primary inline-block">Back to Orders</Link>
        </div>
      </div>
    )
  }

  const currentIdx = STEPS.indexOf(order.status)
  const isTerminal = ['CANCELLED', 'REJECTED', 'REFUNDED', 'COMPLETED'].includes(order.status)

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <header className="bg-white sticky top-0 z-30 border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <Link href="/customer/orders" className="p-1 -ml-1 rounded-lg hover:bg-slate-100"><ArrowLeft className="w-5 h-5 text-slate-700" /></Link>
        <div>
          <h1 className="font-bold">{order.orderNumber}</h1>
          <p className="text-xs text-slate-500">{order.vendor?.businessName}</p>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Status tracker */}
        <div className="card p-4">
          <p className="font-bold mb-4 text-slate-900">
            {LABELS[order.status] || order.status}
          </p>
          <OrderTimeline status={order.status} />
        </div>

        {/* Items */}
        <div className="card p-4">
          <h2 className="font-bold mb-3">Items</h2>
          <div className="space-y-2 text-sm">
            {order.items?.map((item: any) => (
              <div key={item.id} className="flex justify-between">
                <span>
                  {item.quantity} × {item.productName}
                  {item.instructions && (
                    <span className="block text-xs text-accent-600">📝 {item.instructions}</span>
                  )}
                </span>
                <span>KES {item.subtotal}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 mt-3 pt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>KES {order.subtotal}</span></div>
            <div className="flex justify-between"><span>Delivery</span><span>KES {order.deliveryFee}</span></div>
            <div className="flex justify-between"><span>Service</span><span>KES {order.serviceFee}</span></div>
            {order.discount > 0 && (
              <div className="flex justify-between text-green-600"><span>Discount</span><span>−KES {order.discount}</span></div>
            )}
            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span className="text-primary-700">KES {order.total}</span>
            </div>
          </div>
        </div>

        {/* Rider tracking */}
        {riderLoc?.rider && (
          <div className="card p-4 text-sm">
            <h2 className="font-bold mb-2">🛵 Rider</h2>
            <p>{riderLoc.rider.name} · {riderLoc.rider.phone}</p>
            <p className="text-slate-500 mt-1">Status: {riderLoc.status}</p>
            {(riderLoc.rider.currentLat || riderLoc.lastPoint) && (
              <p className="text-xs text-slate-400 mt-1">
                Last location:{' '}
                {(riderLoc.rider.currentLat || riderLoc.lastPoint?.latitude)?.toFixed?.(4)}
                ,{' '}
                {(riderLoc.rider.currentLng || riderLoc.lastPoint?.longitude)?.toFixed?.(4)}
              </p>
            )}
            {(riderLoc.rider.currentLat || riderLoc.lastPoint?.latitude) && (
              <a
                href={`https://www.google.com/maps?q=${riderLoc.rider.currentLat || riderLoc.lastPoint?.latitude},${riderLoc.rider.currentLng || riderLoc.lastPoint?.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-primary-600 font-medium text-sm"
              >
                📍 Open in Maps
              </a>
            )}
          </div>
        )}

        {/* Payment */}
        <div className="card p-4 text-sm">
          <h2 className="font-bold mb-2">Payment</h2>
          <p>
            Method:{' '}
            <span className="font-medium">
              {order.paymentMethod === 'MPESA' ? 'M-Pesa' : 'Cash on Delivery'}
            </span>
          </p>
          {order.payment && (
            <p className="mt-1">
              Status:{' '}
              <span className="font-medium">{order.payment.status}</span>
              {order.payment.mpesaReceipt && (
                <span className="text-slate-500"> · Receipt: {order.payment.mpesaReceipt}</span>
              )}
            </p>
          )}
          {order.status === 'PENDING_PAYMENT' && order.paymentMethod === 'MPESA' && (
            <button
              className="btn-primary w-full mt-3 text-sm"
              onClick={async () => {
                setPaying(true)
                try {
                  const res = await fetch(`/api/orders/${order.id}/pay`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                  })
                  const data = await res.json()
                  if (res.ok) toast(data.message || 'Check your phone for M-Pesa', 'success')
                  else toast(data.error || 'Payment failed', 'error')
                } catch {
                  toast('Network error', 'error')
                } finally {
                  setPaying(false)
                }
              }}
              disabled={paying}
            >
              {paying ? "Sending…" : "Retry M-Pesa Payment"}
            </button>
          )}
        </div>

        {order.deliveryNotes && (
          <div className="card p-4 text-sm">
            <h2 className="font-bold mb-1">Delivery notes</h2>
            <p className="text-slate-600">{order.deliveryNotes}</p>
          </div>
        )}

        {['DELIVERED', 'COMPLETED'].includes(order.status) && !order.review && (
          <Link
            href={`/customer/review?orderId=${order.id}`}
            className="btn-primary w-full text-center block"
          >
            ⭐ Rate this order
          </Link>
        )}
      </main>
    </div>
  )
}
