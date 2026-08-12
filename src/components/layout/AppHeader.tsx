'use client'

import Link from 'next/link'
import { Leaf, Bell } from 'lucide-react'
import { AccountMenu } from './AccountMenu'
import type { AuthUser } from '@/hooks/useAuth'

type AppHeaderProps = {
  user: AuthUser | null
  onLogout: () => Promise<void>
  title?: string
  showLogo?: boolean
  rightSlot?: React.ReactNode
  notificationsHref?: string
}

export function AppHeader({
  user,
  onLogout,
  title,
  showLogo = true,
  rightSlot,
  notificationsHref,
}: AppHeaderProps) {
  return (
    <header className="bg-white sticky top-0 z-40 border-b border-slate-100">
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {showLogo && (
            <Link href="/" className="flex items-center gap-1.5 shrink-0">
              <div className="w-8 h-8 rounded-xl bg-primary-600 flex items-center justify-center">
                <Leaf className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-bold text-slate-900 hidden sm:inline">
                Mboga Market
              </span>
            </Link>
          )}
          {title && (
            <h1 className="font-semibold text-slate-900 truncate text-lg">
              {title}
            </h1>
          )}
        </div>

        <div className="flex items-center gap-2">
          {rightSlot}
          {notificationsHref && (
            <Link
              href={notificationsHref}
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 transition"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
            </Link>
          )}
          <AccountMenu user={user} onLogout={onLogout} />
        </div>
      </div>
    </header>
  )
}
