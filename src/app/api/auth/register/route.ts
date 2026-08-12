import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { normalizePhone, phoneToEmail } from '@/lib/auth'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { registerSchema, parseBody } from '@/lib/validation/schemas'

const PUBLIC_ROLES = new Set(['CUSTOMER', 'VENDOR', 'RIDER'])

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req)
    const rl = rateLimit(`register:${ip}`, 5, 60_000)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many registrations. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      )
    }
    const raw = await req.json()
    const parsed = parseBody(registerSchema, {
      phone: raw.phone,
      password: raw.password,
      name: raw.name,
      role: raw.role || 'CUSTOMER',
      businessName: raw.businessName,
      location: raw.location,
      vehicleType: raw.vehicleType,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid registration data', details: parsed.error },
        { status: 400 }
      )
    }

    const {
      phone: rawPhone,
      password,
      name,
      role: rawRole,
      businessName,
      location,
      vehicleType,
    } = parsed.data

    const role = String(rawRole).toUpperCase()
    // CRITICAL: public registration cannot create ADMIN
    if (!PUBLIC_ROLES.has(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Public registration allows CUSTOMER, VENDOR or RIDER only.' },
        { status: 403 }
      )
    }

    const phone = normalizePhone(rawPhone)
    const email = phoneToEmail(phone)
    const admin = createAdminClient()

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { phone, role, name },
    })

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || 'Could not create account' },
        { status: 400 }
      )
    }

    const userId = authData.user.id

    const { error: profileError } = await admin.from('profiles').insert({
      id: userId,
      phone,
      email: raw.email ?? null,
      role,
      name,
      is_active: true,
    })

    if (profileError) {
      await admin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    let roleError: { message: string } | null = null
    if (role === 'CUSTOMER') {
      const { error } = await admin.from('customers').insert({
        user_id: userId,
        name,
        phone,
        email: raw.email ?? null,
      })
      roleError = error
    } else if (role === 'VENDOR') {
      const { error } = await admin.from('vendors').insert({
        user_id: userId,
        business_name: businessName || `${name}'s Stall`,
        owner_name: name,
        phone,
        location: location || 'Kiambu Town',
        status: 'PENDING',
        is_open: true,
      })
      roleError = error
    } else if (role === 'RIDER') {
      const { error } = await admin.from('riders').insert({
        user_id: userId,
        name,
        phone,
        vehicle_type: vehicleType || 'boda',
        is_available: true,
        is_verified: false,
      })
      roleError = error
    }

    if (roleError) {
      // Roll back profile + auth user so login cannot succeed with a broken account
      await admin.from('profiles').delete().eq('id', userId)
      await admin.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { error: roleError.message || 'Could not create role profile' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      message: 'Account created. Please log in.',
      userId,
    })
  } catch (err: any) {
    console.error('Register error', err)
    return NextResponse.json({ error: err.message || 'Registration failed' }, { status: 500 })
  }
}
