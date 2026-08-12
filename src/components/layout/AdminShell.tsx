'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Store,
  Users,
  Package,
  Bike,
  Wallet,
  Tags,
  Settings,
  LogOut,
  Leaf,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { AuthUser } from '@/hooks/useAuth'

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/vendors', label: 'Vendors', icon: Store },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/orders', label: 'Orders', icon: Package },
  { href: '/admin/payouts', label: 'Payouts', icon: Wallet },
  { href: '/admin/categories', label: 'Categories', icon: Tags },
]

type AdminShellProps = {
  user: AuthUser | null
  onLogout: () => Promise<void>
  children: React.ReactNode
  title?: string
}

export function AdminShell({ user, onLogout, children, title }: AdminShellProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    await onLogout()
    setLoggingOut(false)
  }

  const SidebarContent = (
    <>
      <div className="px-4 py-5 flex items-center gap-2 border-b border-slate-200">
        <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center">
          <Leaf className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-slate-900 text-sm">Mboga Market</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Admin</p>
        </div>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition',
                active
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              <Icon className="w-4.5 h-4.5" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-slate-200 p-3 space-y-1">
        <div className="px-3 py-2 text-xs text-slate-500 truncate">
          {user?.name || user?.phone || 'Admin'}
        </div>
        <button
          onClick={() => setConfirmLogout(true)}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50"
        >
          <LogOut className="w-4.5 h-4.5" />
          Log out
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-col bg-white border-r border-slate-200 fixed inset-y-0 left-0 z-30">
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white flex flex-col shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-3 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 lg:ml-60 min-h-screen flex flex-col">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 py-3 flex items-center gap-3">
          <button
            className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 hover:bg-slate-100"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-slate-900 text-lg">
            {title || 'Admin'}
          </h1>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        title="Log out?"
        message="Are you sure you want to log out of the admin panel?"
        confirmLabel="Log out"
        danger
        loading={loggingOut}
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  )
}
