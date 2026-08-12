'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialRole = (searchParams.get('role') || 'CUSTOMER').toUpperCase()

  const [role, setRole] = useState<'CUSTOMER' | 'VENDOR' | 'RIDER'>(
    ['CUSTOMER', 'VENDOR', 'RIDER'].includes(initialRole)
      ? (initialRole as any)
      : 'CUSTOMER'
  )
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          password,
          role,
          businessName: role === 'VENDOR' ? businessName : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Registration failed')
        return
      }
      setSuccess(data.message || 'Registered successfully')
      setTimeout(() => {
        if (role === 'VENDOR') router.push('/vendor')
        else if (role === 'RIDER') router.push('/rider')
        else router.push('/customer')
      }, 1200)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="p-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-primary-700">
          <span className="text-2xl">🥬</span> Mboga Market
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="card w-full max-w-md p-8">
          <h1 className="text-2xl font-bold mb-1">Create account</h1>
          <p className="text-slate-500 mb-6">Join Mboga Market</p>

          {/* Role selector */}
          <div className="flex gap-2 mb-6">
            {(['CUSTOMER', 'VENDOR', 'RIDER'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 ${
                  role === r
                    ? 'border-primary-600 bg-primary-50 text-primary-700'
                    : 'border-slate-200 text-slate-500'
                }`}
              >
                {r === 'CUSTOMER' ? 'Customer' : r === 'VENDOR' ? 'Vendor' : 'Rider'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Full name</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Jane Wanjiru"
              />
            </div>

            {role === 'VENDOR' && (
              <div>
                <label className="block text-sm font-medium mb-1">Business / Stall name</label>
                <input
                  className="input"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                  placeholder="Mama Jane Fresh Greens"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Phone number</label>
              <input
                type="tel"
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="0712 345 678"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="At least 6 characters"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>
            )}
            {success && (
              <p className="text-green-700 text-sm bg-green-50 p-3 rounded-lg">{success}</p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          {role === 'VENDOR' && (
            <p className="mt-4 text-xs text-slate-500 text-center">
              Vendor accounts require admin approval before you can receive orders.
            </p>
          )}

          <p className="mt-6 text-center text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-primary-600 font-semibold">
              Log in
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading…</div>}>
      <RegisterForm />
    </Suspense>
  )
}
