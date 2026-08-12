'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Search,
  ShoppingCart,
  Package,
  User,
  LayoutDashboard,
  Bike,
  Wallet,
  Store,
  ClipboardList,
  Tags,
} from 'lucide-react'
import clsx from 'clsx'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  match?: (path: string) => boolean
  badge?: number
}

const customerNavBase: Omit<NavItem, 'badge'>[] = [
  { href: '/customer', label: 'Home', icon: Home, match: (p) => p === '/customer' },
  { href: '/customer/search', label: 'Search', icon: Search },
  { href: '/customer/cart', label: 'Cart', icon: ShoppingCart },
  { href: '/customer/orders', label: 'Orders', icon: Package },
  { href: '/customer/account', label: 'Account', icon: User },
]

const vendorNav: NavItem[] = [
  { href: '/vendor', label: 'Dashboard', icon: LayoutDashboard, match: (p) => p === '/vendor' },
  { href: '/vendor/orders', label: 'Orders', icon: ClipboardList },
  { href: '/vendor/products', label: 'Products', icon: Tags },
  { href: '/vendor/morning', label: 'Prices', icon: Store },
]

const riderNav: NavItem[] = [
  { href: '/rider', label: 'Home', icon: Home, match: (p) => p === '/rider' },
  { href: '/rider/deliveries', label: 'Deliveries', icon: Bike },
  { href: '/rider/earnings', label: 'Earnings', icon: Wallet },
]

type BottomNavProps = {
  role: 'CUSTOMER' | 'VENDOR' | 'RIDER'
}

export function BottomNav({ role }: BottomNavProps) {
  const pathname = usePathname()
  const [cartCount, setCartCount] = useState(0)

  useEffect(() => {
    if (role !== 'CUSTOMER') return
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/cart')
        if (!res.ok) return
        const data = await res.json()
        const groups = data.groups || []
        const count = groups.reduce(
          (s: number, g: any) =>
            s + (g.items || []).reduce((a: number, i: any) => a + (i.quantity || 0), 0),
          0
        )
        if (!cancelled) setCartCount(count)
      } catch {
        /* ignore */
      }
    }
    load()
    const t = setInterval(load, 15000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [role, pathname])

  const items: NavItem[] =
    role === 'CUSTOMER'
      ? customerNavBase.map((item) =>
          item.href === '/customer/cart'
            ? { ...item, badge: cartCount }
            : item
        )
      : role === 'VENDOR'
        ? vendorNav
        : riderNav

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex justify-around py-1.5 z-40 safe-bottom">
      {items.map((item) => {
        const active = item.match
          ? item.match(pathname)
          : pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'flex flex-col items-center gap-0.5 px-2 py-1.5 min-w-[64px] rounded-xl transition relative',
              active
                ? 'text-primary-600'
                : 'text-slate-400 hover:text-slate-600'
            )}
          >
            <span className="relative">
              <Icon className={clsx('w-5 h-5', active && 'stroke-[2.5]')} />
              {item.badge != null && item.badge > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-accent-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </span>
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
