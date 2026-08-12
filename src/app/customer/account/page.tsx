'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Package,
  MapPin,
  ShoppingCart,
  Heart,
  Bell,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { BottomNav } from '@/components/layout/BottomNav'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ListSkeleton } from '@/components/ui/LoadingSkeleton'
import { ErrorBanner } from '@/components/ui/ErrorBanner'

export default function CustomerAccountPage() {
  const { user, loading: authLoading, error: authError, logout, reload } = useAuth({
    requiredRole: 'CUSTOMER',
  })
  const [addresses, setAddresses] = useState<any[]>([])
  const [loadingAddr, setLoadingAddr] = useState(true)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoadingAddr(true)
      try {
        const addr = await fetch('/api/addresses')
        if (addr.ok) {
          const a = await addr.json()
          setAddresses(a.addresses || [])
        }
      } catch {
        /* ignore */
      } finally {
        setLoadingAddr(false)
      }
    }
    load()
  }, [user])

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
    setLoggingOut(false)
  }

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

  const displayName = user?.name || user?.customer?.name || 'Customer'
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-white border-b border-slate-100 px-4 py-4">
        <h1 className="font-bold text-lg text-slate-900">My Account</h1>
      </header>

      <main className="p-4 space-y-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center text-lg font-bold text-primary-700">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-lg truncate">{displayName}</p>
            <p className="text-sm text-slate-500">{user?.phone}</p>
            {user?.email && (
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            )}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
            <h2 className="font-semibold text-slate-900">Delivery addresses</h2>
            <Link
              href="/customer/addresses"
              className="text-sm text-primary-600 font-semibold"
            >
              Manage
            </Link>
          </div>
          {loadingAddr ? (
            <div className="p-4">
              <div className="h-10 bg-slate-100 animate-pulse rounded-lg" />
            </div>
          ) : addresses.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              No addresses yet.{' '}
              <Link href="/customer/addresses" className="text-primary-600 font-medium">
                Add one
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {addresses.slice(0, 3).map((a) => (
                <div key={a.id} className="px-4 py-3 text-sm">
                  <p className="font-semibold text-slate-800">
                    {a.label}
                    {a.isDefault && (
                      <span className="ml-2 text-[10px] bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded font-medium">
                        DEFAULT
                      </span>
                    )}
                  </p>
                  <p className="text-slate-500 mt-0.5">
                    {a.estate}
                    {a.street ? `, ${a.street}` : ''}
                    {a.landmark ? ` · ${a.landmark}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card divide-y divide-slate-100">
          {[
            { href: '/customer/orders', icon: Package, label: 'My Orders' },
            { href: '/customer/addresses', icon: MapPin, label: 'Addresses' },
            { href: '/customer/cart', icon: ShoppingCart, label: 'Cart' },
            { href: '/customer/favorites', icon: Heart, label: 'Favourites' },
            { href: '/customer/notifications', icon: Bell, label: 'Notifications' },
          ].map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3.5 text-slate-800 hover:bg-slate-50 transition"
              >
                <Icon className="w-5 h-5 text-slate-400" />
                <span className="flex-1 font-medium">{item.label}</span>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </Link>
            )
          })}
        </div>

        <button
          onClick={() => setConfirmLogout(true)}
          className="w-full card py-3.5 text-red-600 font-semibold text-center flex items-center justify-center gap-2 hover:bg-red-50 transition"
        >
          <LogOut className="w-4 h-4" />
          Log out
        </button>

        <p className="text-center text-xs text-slate-400 pt-2">
          Mboga Market · Fresh from your neighbourhood
        </p>
      </main>

      <BottomNav role="CUSTOMER" />

      <ConfirmDialog
        open={confirmLogout}
        title="Log out?"
        message="Are you sure you want to log out of Mboga Market?"
        confirmLabel="Log out"
        danger
        loading={loggingOut}
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  )
}
