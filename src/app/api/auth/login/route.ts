import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { normalizePhone, phoneToEmail } from '@/lib/auth'
import { loginSchema, parseBody } from '@/lib/validation/schemas'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req)
    const rl = rateLimit(`login:${ip}`, 10, 60_000)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfterSec) },
        }
      )
    }

    const body = await req.json()
    const parsed = parseBody(loginSchema, body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid phone or password format' },
        { status: 400 }
      )
    }

    const phone = normalizePhone(parsed.data.phone)
    const email = phoneToEmail(phone)
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: parsed.data.password,
    })
    if (error || !data.user) {
      return NextResponse.json(
        { error: 'Invalid phone or password' },
        { status: 401 }
      )
    }

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('id, phone, role, name, is_active')
      .eq('id', data.user.id)
      .single()

    if (!profile || !profile.is_active) {
      await supabase.auth.signOut()
      return NextResponse.json({ error: 'Account inactive' }, { status: 403 })
    }

    return NextResponse.json({
      message: 'Logged in',
      user: {
        id: profile.id,
        phone: profile.phone,
        role: profile.role,
        name: profile.name,
      },
    })
  } catch (err) {
    console.error('Login error', err)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
