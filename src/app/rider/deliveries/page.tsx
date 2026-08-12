'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { BottomNav } from '@/components/layout/BottomNav'
import { useRouter } from 'next/navigation'

export default function RiderDeliveriesPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'available' | 'active'>('available')
  const [available, setAvailable] = useState<any[]>([])
  const [active, setActive] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)

  async function load() {
    try {
      const [a, b] = await Promise.all([
        fetch('/api/deliveries?type=available').then((r) => r.json()),
        fetch('/api/deliveries?type=active').then((r) => r.json()),
      ])
      if (a.error === 'Unauthorized' || b.error === 'Unauthorized') {
        router.push('/login')
        return
      }
      setAvailable(a.deliveries || [])
      setActive(b.deliveries || [])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [])

  // Push GPS while on this page (for live tracking)
  useEffect(() => {
    if (!navigator.geolocation) return
    const ping = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetch('/api/rider/location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }),
          }).catch(() => {})
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 30000 }
      )
    }
    ping()
    const t = setInterval(ping, 30000)
    return () => clearInterval(t)
  }, [])

  async function accept(orderId: string) {
    setActionId(orderId)
    try {
      const res = await fetch('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed')
      } else {
        setTab('active')
        await load()
      }
    } catch {
      alert('Network error')
    } finally {
      setActionId(null)
    }
  }

  async function doAction(deliveryId: string, action: string) {
    setActionId(deliveryId)
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed')
      } else {
        await load()
      }
    } catch {
      alert('Network error')
    } finally {
      setActionId(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-24">
      <header className="bg-slate-800 text-white p-4 flex items-center gap-3">
        <Link href="/rider" className="text-2xl">←</Link>
        <h1 className="text-xl font-bold">Deliveries</h1>
      </header>

      <div className="p-4 flex gap-2">
        <button
          onClick={() => setTab('available')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold ${
            tab === 'available' ? 'bg-accent-500 text-white' : 'bg-white text-slate-600'
          }`}
        >
          Available ({available.length})
        </button>
        <button
          onClick={() => setTab('active')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold ${
            tab === 'active' ? 'bg-primary-600 text-white' : 'bg-white text-slate-600'
          }`}
        >
          Active ({active.length})
        </button>
      </div>

      <main className="px-4 space-y-4">
        {loading && <div className="h-32 bg-white animate-pulse rounded-2xl" />}

        {tab === 'available' && !loading && available.length === 0 && (
          <div className="card p-10 text-center text-slate-500">
            <p className="text-4xl mb-2">🛵</p>
            <p className="font-medium">No available deliveries</p>
            <p className="text-sm mt-1">Orders appear when vendors mark them ready</p>
          </div>
        )}

        {tab === 'available' &&
          available.map((d) => (
            <div key={d.orderId} className="card p-4 border-2 border-accent-300">
              <div className="flex justify-between mb-2">
                <p className="font-bold text-lg">{d.orderNumber}</p>
                <span className="text-sm font-bold text-green-600">
                  ~KES {d.estimatedEarnings}
                </span>
              </div>
              <div className="text-sm space-y-1 mb-4">
                <p>
                  <span className="text-slate-500">Pickup:</span>{' '}
                  <strong>{d.vendor?.businessName}</strong>
                </p>
                <p className="text-slate-500">{d.vendor?.location}</p>
                <p>
                  <span className="text-slate-500">Customer:</span> {d.customer?.name}
                </p>
                <p className="text-slate-500">{d.itemCount} items · Order KES {d.total}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => accept(d.orderId)}
                  disabled={actionId === d.orderId}
                  className="flex-1 bg-primary-600 text-white font-bold py-3 rounded-xl text-lg"
                >
                  {actionId === d.orderId ? '…' : 'ACCEPT'}
                </button>
              </div>
            </div>
          ))}

        {tab === 'active' && !loading && active.length === 0 && (
          <div className="card p-10 text-center text-slate-500">
            <p className="font-medium">No active deliveries</p>
            <p className="text-sm mt-1">Accept a job from Available</p>
          </div>
        )}

        {tab === 'active' &&
          active.map((d) => (
            <div key={d.id} className="card p-4">
              <div className="flex justify-between mb-2">
                <p className="font-bold text-lg">{d.orderNumber}</p>
                <span className="text-xs font-semibold bg-primary-100 text-primary-700 px-2 py-1 rounded">
                  {d.status}
                </span>
              </div>

              <div className="text-sm space-y-1 mb-4 bg-slate-50 rounded-xl p-3">
                <p>
                  <strong>Pickup:</strong> {d.vendor?.businessName}
                </p>
                <p className="text-slate-500">{d.vendor?.location}</p>
                <p>
                  <strong>Customer:</strong> {d.customer?.name} · {d.customer?.phone}
                </p>
                {d.deliveryNotes && (
                  <p className="text-accent-600">📝 {d.deliveryNotes}</p>
                )}
                <p className="font-semibold text-green-600">Earn KES {d.earnings}</p>
              </div>

              {/* Action buttons based on status */}
              <div className="space-y-2">
                {d.status === 'ASSIGNED' && (
                  <>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${d.vendor?.latitude || ''},${d.vendor?.longitude || ''}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center bg-slate-200 font-bold py-3 rounded-xl"
                    >
                      📍 NAVIGATE TO PICKUP
                    </a>
                    <button
                      onClick={() => doAction(d.id, 'PICKED_UP')}
                      disabled={actionId === d.id}
                      className="w-full bg-primary-600 text-white font-bold py-4 rounded-xl text-lg"
                    >
                      {actionId === d.id ? '…' : 'PICKED UP'}
                    </button>
                  </>
                )}

                {d.status === 'PICKED_UP' && (
                  <button
                    onClick={() => doAction(d.id, 'START_DELIVERY')}
                    disabled={actionId === d.id}
                    className="w-full bg-sky-600 text-white font-bold py-4 rounded-xl text-lg"
                  >
                    {actionId === d.id ? '…' : 'START DELIVERY'}
                  </button>
                )}

                {d.status === 'IN_TRANSIT' && (
                  <button
                    onClick={() => doAction(d.id, 'DELIVERED')}
                    disabled={actionId === d.id}
                    className="w-full bg-green-600 text-white font-bold py-4 rounded-xl text-lg"
                  >
                    {actionId === d.id ? '…' : 'DELIVERED'}
                  </button>
                )}
              </div>
            </div>
          ))}
      </main>

      <BottomNav role="RIDER" />
    </div>
  )
}
