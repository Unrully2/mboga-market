'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bike, Wallet } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { BottomNav } from '@/components/layout/BottomNav'
import { AccountMenu } from '@/components/layout/AccountMenu'
import { ListSkeleton } from '@/components/ui/LoadingSkeleton'
import { ErrorBanner } from '@/components/ui/ErrorBanner'

export default function RiderHome() {
  const { user, loading: authLoading, error: authError, logout, reload } = useAuth({
    requiredRole: 'RIDER',
  })
  const [available, setAvailable] = useState(0)
  const [active, setActive] = useState(0)
  const [earningsToday, setEarningsToday] = useState(0)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoadingData(true)
      try {
        const [avail, act, hist] = await Promise.all([
          fetch('/api/deliveries?type=available').then((r) => r.json()),
          fetch('/api/deliveries?type=active').then((r) => r.json()),
          fetch('/api/deliveries?type=history').then((r) => r.json()),
        ])
        setAvailable((avail.deliveries || []).length)
        setActive((act.deliveries || []).length)

        const today = new Date().toDateString()
        const todayEarn = (hist.deliveries || [])
          .filter(
            (d: any) =>
              d.deliveredAt && new Date(d.deliveredAt).toDateString() === today
          )
          .reduce((s: number, d: any) => s + (d.earnings || 0), 0)
        setEarningsToday(todayEarn)
      } catch {
        /* ignore */
      } finally {
        setLoadingData(false)
      }
    }
    load()
  }, [user])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-100 p-4 pb-24">
        <ListSkeleton count={3} />
      </div>
    )
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-slate-100">
        <ErrorBanner message={authError} onRetry={reload} />
      </div>
    )
  }

  const name = user?.name || user?.rider?.name || 'Rider'

  return (
    <div className="min-h-screen bg-slate-100 pb-24">
      <header className="bg-slate-800 text-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-300 text-sm">Rider</p>
            <h1 className="text-xl font-bold">{name}</h1>
          </div>
          <AccountMenu user={user} onLogout={logout} />
        </div>
      </header>

      <main className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-3 text-center">
            <p className="text-2xl font-bold text-accent-500">
              {loadingData ? '…' : available}
            </p>
            <p className="text-xs text-slate-500">Available</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-2xl font-bold text-primary-600">
              {loadingData ? '…' : active}
            </p>
            <p className="text-xs text-slate-500">Active</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-2xl font-bold text-green-600">
              {loadingData ? '…' : `KES ${earningsToday}`}
            </p>
            <p className="text-xs text-slate-500">Today</p>
          </div>
        </div>

        <Link
          href="/rider/deliveries"
          className="card p-5 flex items-center gap-4 active:scale-95 transition border-2 border-accent-300 hover:bg-accent-50"
        >
          <div className="w-12 h-12 rounded-2xl bg-accent-50 flex items-center justify-center">
            <Bike className="w-6 h-6 text-accent-500" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-lg">Deliveries</p>
            <p className="text-sm text-slate-500">
              {available > 0
                ? `${available} available now`
                : 'Check for new jobs'}
            </p>
          </div>
          {available > 0 && (
            <span className="bg-accent-500 text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center">
              {available}
            </span>
          )}
        </Link>

        <Link
          href="/rider/earnings"
          className="card p-5 flex items-center gap-4 active:scale-95 transition hover:shadow-md"
        >
          <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="font-bold text-lg">Earnings</p>
            <p className="text-sm text-slate-500">History & totals</p>
          </div>
        </Link>
      </main>

      <BottomNav role="RIDER" />
    </div>
  )
}
