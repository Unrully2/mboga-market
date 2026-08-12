'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Leaf } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Login failed')
        return
      }
      // Redirect by role
      const role = data.user?.role
      if (role === 'ADMIN') router.replace('/admin')
      else if (role === 'VENDOR') router.replace('/vendor')
      else if (role === 'RIDER') router.replace('/rider')
      else router.replace('/customer')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="p-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-primary-700">
          <Leaf className="w-6 h-6 text-primary-600" /> Mboga Market
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="card w-full max-w-md p-8">
          <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
          <p className="text-slate-500 mb-6">Log in with your phone number</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Phone number</label>
              <input
                type="tel"
                className="input"
                placeholder="0712 345 678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>
            )}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Demo: 254712345678 / password123
          </p>
          <p className="mt-4 text-center text-sm">
            No account?{' '}
            <Link href="/register" className="text-primary-600 font-semibold">
              Register
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
