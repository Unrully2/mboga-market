import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export type AppRole = 'CUSTOMER' | 'VENDOR' | 'RIDER' | 'ADMIN'

export type AppUser = {
  id: string
  phone: string
  email: string | null
  role: AppRole
  name: string | null
  isActive: boolean
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

export function normalizePhone(phone: string): string {
  let p = phone.replace(/\s+/g, '').replace(/^\+/, '')
  if (p.startsWith('0')) p = '254' + p.slice(1)
  if (!p.startsWith('254')) p = '254' + p
  return p
}

export function phoneToEmail(phone: string): string {
  return `${normalizePhone(phone)}@users.mboga.local`
}

export async function getCurrentUser(): Promise<AppUser | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.is_active) return null

    const base: AppUser = {
      id: profile.id,
      phone: profile.phone,
      email: profile.email,
      role: profile.role as AppRole,
      name: profile.name,
      isActive: profile.is_active,
    }

    if (profile.role === 'CUSTOMER') {
      const { data: c } = await admin
        .from('customers')
        .select('id, name, phone')
        .eq('user_id', user.id)
        .maybeSingle()
      base.customer = c
    } else if (profile.role === 'VENDOR') {
      const { data: v } = await admin
        .from('vendors')
        .select('id, business_name, phone, status, is_open')
        .eq('user_id', user.id)
        .maybeSingle()
      if (v) {
        base.vendor = {
          id: v.id,
          businessName: v.business_name,
          phone: v.phone,
          status: v.status,
          isOpen: v.is_open,
        }
      }
    } else if (profile.role === 'RIDER') {
      const { data: r } = await admin
        .from('riders')
        .select('id, name, phone, is_available, is_verified')
        .eq('user_id', user.id)
        .maybeSingle()
      if (r) {
        base.rider = {
          id: r.id,
          name: r.name,
          phone: r.phone,
          isAvailable: r.is_available,
          isVerified: r.is_verified,
        }
      }
    }

    return base
  } catch (err) {
    console.error('getCurrentUser error', err)
    return null
  }
}

/**
 * Require an authenticated, active user.
 * Returns { user } or a NextResponse error to return immediately.
 */
export async function requireAuth(): Promise<
  { user: AppUser; error?: never } | { user?: never; error: NextResponse }
> {
  const user = await getCurrentUser()
  if (!user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  return { user }
}

/**
 * Require authenticated user with one of the allowed roles.
 * Also ensures the role-specific profile record exists (customer/vendor/rider).
 */
export async function requireRole(
  roles: AppRole | AppRole[]
): Promise<
  { user: AppUser; error?: never } | { user?: never; error: NextResponse }
> {
  const allowed = Array.isArray(roles) ? roles : [roles]
  const user = await getCurrentUser()
  if (!user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  if (!allowed.includes(user.role)) {
    return {
      error: NextResponse.json(
        { error: 'Forbidden: insufficient role' },
        { status: 403 }
      ),
    }
  }
  // Role profile must exist for operational roles
  if (user.role === 'CUSTOMER' && !user.customer) {
    return {
      error: NextResponse.json(
        { error: 'Customer profile required' },
        { status: 403 }
      ),
    }
  }
  if (user.role === 'VENDOR' && !user.vendor) {
    return {
      error: NextResponse.json(
        { error: 'Vendor profile required' },
        { status: 403 }
      ),
    }
  }
  if (user.role === 'RIDER' && !user.rider) {
    return {
      error: NextResponse.json(
        { error: 'Rider profile required' },
        { status: 403 }
      ),
    }
  }
  return { user }
}

/**
 * Assert that a customer owns a given customerId (or is admin).
 */
export function assertCustomerOwnership(
  user: AppUser,
  customerId: string
): NextResponse | null {
  if (user.role === 'ADMIN') return null
  if (user.role !== 'CUSTOMER' || user.customer?.id !== customerId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

/**
 * Assert that a vendor owns a given vendorId (or is admin).
 */
export function assertVendorOwnership(
  user: AppUser,
  vendorId: string
): NextResponse | null {
  if (user.role === 'ADMIN') return null
  if (user.role !== 'VENDOR' || user.vendor?.id !== vendorId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

/**
 * Assert that a rider owns a given riderId (or is admin).
 */
export function assertRiderOwnership(
  user: AppUser,
  riderId: string
): NextResponse | null {
  if (user.role === 'ADMIN') return null
  if (user.role !== 'RIDER' || user.rider?.id !== riderId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

export function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
