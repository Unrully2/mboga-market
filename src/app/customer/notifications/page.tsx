'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BottomNav } from '@/components/layout/BottomNav'
import { useRouter } from 'next/navigation'

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const res = await fetch('/api/notifications')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      const data = await res.json()
      setNotifications(data.notifications || [])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAll: true }),
    })
    load()
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <header className="bg-white sticky top-0 border-b border-slate-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/customer/account" className="text-2xl">←</Link>
          <h1 className="font-bold text-lg">Notifications</h1>
        </div>
        {notifications.some((n) => !n.isRead) && (
          <button onClick={markAllRead} className="text-sm text-primary-600 font-medium">
            Mark all read
          </button>
        )}
      </header>

      <main className="p-4 space-y-2">
        {loading && <div className="h-16 bg-slate-200 animate-pulse rounded-xl" />}

        {!loading && notifications.length === 0 && (
          <div className="card p-10 text-center text-slate-500">
            <p className="text-4xl mb-2">🔔</p>
            <p>No notifications yet</p>
          </div>
        )}

        {notifications.map((n) => {
          let orderId = null
          try {
            if (n.data) orderId = JSON.parse(n.data)?.orderId
          } catch { /* ignore */ }

          const content = (
            <div
              className={`card p-4 ${!n.isRead ? 'border-l-4 border-l-primary-500' : ''}`}
            >
              <p className="font-semibold text-sm">{n.title}</p>
              <p className="text-sm text-slate-600 mt-0.5">{n.body}</p>
              <p className="text-xs text-slate-400 mt-1">
                {new Date(n.createdAt).toLocaleString('en-KE')}
              </p>
            </div>
          )

          return orderId ? (
            <Link key={n.id} href={`/customer/orders/${orderId}`}>
              {content}
            </Link>
          ) : (
            <div key={n.id}>{content}</div>
          )
        })}
      </main>
          <BottomNav role="CUSTOMER" />
    </div>
  )
}
