'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  User,
  Settings,
  HelpCircle,
  LogOut,
  MapPin,
  Heart,
  Bell,
  ChevronRight,
} from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { AuthUser } from '@/hooks/useAuth'

type AccountMenuProps = {
  user: AuthUser | null
  onLogout: () => Promise<void>
  /** Extra links specific to the role */
  extraLinks?: { href: string; label: string; icon?: React.ReactNode }[]
}

export function AccountMenu({ user, onLogout, extraLinks = [] }: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const displayName =
    user?.name ||
    user?.customer?.name ||
    user?.vendor?.businessName ||
    user?.rider?.name ||
    user?.phone ||
    'Account'

  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  async function handleLogout() {
    setLoggingOut(true)
    await onLogout()
    setLoggingOut(false)
    setConfirmLogout(false)
    setOpen(false)
  }

  const roleHome =
    user?.role === 'CUSTOMER'
      ? '/customer'
      : user?.role === 'VENDOR'
        ? '/vendor'
        : user?.role === 'RIDER'
          ? '/rider'
          : user?.role === 'ADMIN'
            ? '/admin'
            : '/'

  const profileHref =
    user?.role === 'CUSTOMER'
      ? '/customer/account'
      : user?.role === 'VENDOR'
        ? '/vendor'
        : user?.role === 'RIDER'
          ? '/rider'
          : '/admin'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm hover:bg-primary-200 transition focus:outline-none focus:ring-2 focus:ring-primary-400"
        aria-label="Account menu"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <p className="font-semibold text-slate-900 truncate">{displayName}</p>
            <p className="text-xs text-slate-500 mt-0.5 capitalize">
              {user?.role?.toLowerCase() || 'User'}
              {user?.phone ? ` · ${user.phone}` : ''}
            </p>
          </div>

          <div className="py-1">
            <Link
              href={profileHref}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <User className="w-4 h-4 text-slate-400" />
              My Profile
              <ChevronRight className="w-4 h-4 ml-auto text-slate-300" />
            </Link>

            {user?.role === 'CUSTOMER' && (
              <>
                <Link
                  href="/customer/addresses"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <MapPin className="w-4 h-4 text-slate-400" />
                  Addresses
                </Link>
                <Link
                  href="/customer/favorites"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Heart className="w-4 h-4 text-slate-400" />
                  Favourites
                </Link>
                <Link
                  href="/customer/notifications"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Bell className="w-4 h-4 text-slate-400" />
                  Notifications
                </Link>
              </>
            )}

            {extraLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                {link.icon || <Settings className="w-4 h-4 text-slate-400" />}
                {link.label}
              </Link>
            ))}

            <a
              href="mailto:support@mbogamarket.ke"
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <HelpCircle className="w-4 h-4 text-slate-400" />
              Help & Support
            </a>
          </div>

          <div className="border-t border-slate-100 py-1">
            <button
              onClick={() => {
                setOpen(false)
                setConfirmLogout(true)
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 font-medium"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmLogout}
        title="Log out?"
        message="Are you sure you want to log out of Mboga Market?"
        confirmLabel="Log out"
        cancelLabel="Cancel"
        danger
        loading={loggingOut}
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  )
}
