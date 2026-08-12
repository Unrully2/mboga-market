'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export type AuthUser = {
  id: string
  phone: string
  email: string | null
  role: 'CUSTOMER' | 'VENDOR' | 'RIDER' | 'ADMIN'
  name: string | null
  customer?: { id: string; name: string; phone: string } | null
  vendor?: {
    id: string
    businessName: string
    phone: string
    status: string
    isOpen: boolean
  } | null
  rider?: {
    id: string
    name: string
    phone: string
    isAvailable: boolean
    isVerified: boolean
  } | null
}

type UseAuthOptions = {
  requiredRole?: AuthUser['role'] | AuthUser['role'][]
  redirectTo?: string
}

export function useAuth(options: UseAuthOptions = {}) {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      if (res.status === 401) {
        setUser(null)
        router.replace(options.redirectTo || '/login')
        return
      }
      if (!res.ok) {
        throw new Error('Failed to load user')
      }
      const data = await res.json()
      const u = data.user as AuthUser

      if (options.requiredRole) {
        const allowed = Array.isArray(options.requiredRole)
          ? options.requiredRole
          : [options.requiredRole]
        if (!allowed.includes(u.role)) {
          // Redirect to the correct home for their role
          const home =
            u.role === 'CUSTOMER'
              ? '/customer'
              : u.role === 'VENDOR'
                ? '/vendor'
                : u.role === 'RIDER'
                  ? '/rider'
                  : u.role === 'ADMIN'
                    ? '/admin'
                    : '/login'
          router.replace(home)
          return
        }
      }

      setUser(u)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [router, options.requiredRole, options.redirectTo])

  useEffect(() => {
    load()
  }, [load])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } catch {
      /* still redirect */
    }
    setUser(null)
    router.replace('/login')
    router.refresh()
  }, [router])

  return { user, loading, error, reload: load, logout }
}
