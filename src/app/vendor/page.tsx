'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ShoppingCart,
  Leaf,
  Sunrise,
  Wallet,
  Bell,
  Package,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { BottomNav } from '@/components/layout/BottomNav'
import { AccountMenu } from '@/components/layout/AccountMenu'
import { ListSkeleton } from '@/components/ui/LoadingSkeleton'
import { ErrorBanner } from '@/components/ui/ErrorBanner'

export default function VendorDashboard() {
  const { user, loading: authLoading, error: authError, logout, reload } = useAuth({
    requiredRole: 'VENDOR',
  })
  const [pendingCount, setPendingCount] = useState(0)
  const [loadingOrders, setLoadingOrders] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoadingOrders(true)
      try {
        const orders = await fetch('/api/orders')
        if (orders.ok) {
          const data = await orders.json()
          const pending = (data.orders || []).filter((o: any) =>
            ['ORDER_RECEIVED', 'PAYMENT_CONFIRMED'].includes(o.status)
          )
          setPendingCount(pending.length)
        }
      } catch {
        /* ignore */
      } finally {
        setLoadingOrders(false)
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

  const vendorName = user?.vendor?.businessName || user?.name || 'My Stall'
  const isOpen = user?.vendor?.isOpen ?? true

  return (
    <div className="min-h-screen bg-slate-100 pb-24">
      <header className="bg-primary-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-primary-100 text-sm">Vendor dashboard</p>
            <h1 className="text-xl font-bold">{vendorName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                isOpen ? 'bg-white/20' : 'bg-red-500/80'
              }`}
            >
              {isOpen ? 'OPEN' : 'CLOSED'}
            </span>
            <AccountMenu user={user} onLogout={logout} />
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4 -mt-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4">
            <p className="text-xs text-slate-500">Pending Orders</p>
            <p className="text-2xl font-bold text-accent-500">
              {loadingOrders ? '…' : pendingCount}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-slate-500">Store status</p>
            <p className="text-sm font-medium text-primary-700 mt-1">
              {isOpen ? 'Accepting orders' : 'Not accepting'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/vendor/orders"
            className="card p-5 flex flex-col items-center gap-2 active:scale-95 transition relative hover:shadow-md"
          >
            <div className="w-12 h-12 rounded-2xl bg-accent-50 flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-accent-500" />
            </div>
            <span className="font-bold">Orders</span>
            {pendingCount > 0 && (
              <span className="absolute top-2 right-2 bg-accent-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </Link>
          <Link
            href="/vendor/products"
            className="card p-5 flex flex-col items-center gap-2 active:scale-95 transition hover:shadow-md"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center">
              <Leaf className="w-6 h-6 text-primary-600" />
            </div>
            <span className="font-bold">Products</span>
          </Link>
          <Link
            href="/vendor/morning"
            className="card p-5 flex flex-col items-center gap-2 active:scale-95 transition bg-amber-50 border-amber-200 hover:shadow-md"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center">
              <Sunrise className="w-6 h-6 text-amber-600" />
            </div>
            <span className="font-bold text-center">Morning Update</span>
          </Link>
          <Link
            href="/vendor/orders"
            className="card p-5 flex flex-col items-center gap-2 active:scale-95 transition hover:shadow-md"
          >
            <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-green-600" />
            </div>
            <span className="font-bold">Sales</span>
          </Link>
        </div>

        {pendingCount > 0 && (
          <Link
            href="/vendor/orders"
            className="card border-2 border-accent-400 p-4 block hover:bg-accent-50 transition"
          >
            <div className="flex items-center gap-2 mb-1">
              <Bell className="w-5 h-5 text-accent-500" />
              <span className="font-bold text-accent-600">
                {pendingCount} new order{pendingCount > 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-sm text-slate-600">Tap to accept or decline</p>
          </Link>
        )}
      </main>

      <BottomNav role="VENDOR" />
    </div>
  )
}
