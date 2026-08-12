'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function AdminPayoutsPage() {
  const router = useRouter()
  const [payouts, setPayouts] = useState<any[]>([])
  const [balances, setBalances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [amount, setAmount] = useState('')
  const [sendMpesa, setSendMpesa] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    try {
      const res = await fetch('/api/admin/payouts')
      if (res.status === 401 || res.status === 403) {
        router.push('/login')
        return
      }
      const data = await res.json()
      setPayouts(data.payouts || [])
      setBalances(data.vendorBalances || [])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function createPayout() {
    if (!selected || !amount) return
    setSaving(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: selected.vendorId,
          amount: Number(amount),
          sendMpesa,
        }),
      })
      const data = await res.json()
      setMsg(data.message || (res.ok ? 'Done' : data.error))
      if (res.ok) {
        setSelected(null)
        setAmount('')
        load()
      }
    } catch {
      setMsg('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function markPaid(payoutId: string) {
    await fetch('/api/admin/payouts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payoutId, status: 'PAID' }),
    })
    load()
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex">
        <aside className="hidden md:flex flex-col w-56 bg-slate-900 text-white min-h-screen p-4">
          <div className="font-bold text-lg mb-8">🥬 Mboga Admin</div>
          <nav className="space-y-1 text-sm">
            <Link href="/admin" className="block px-3 py-2 rounded-lg hover:bg-slate-800">Dashboard</Link>
            <Link href="/admin/vendors" className="block px-3 py-2 rounded-lg hover:bg-slate-800">Vendors</Link>
            <Link href="/admin/orders" className="block px-3 py-2 rounded-lg hover:bg-slate-800">Orders</Link>
            <Link href="/admin/customers" className="block px-3 py-2 rounded-lg hover:bg-slate-800">Customers</Link>
            <Link href="/admin/categories" className="block px-3 py-2 rounded-lg hover:bg-slate-800">Catalog</Link>
            <Link href="/admin/payouts" className="block px-3 py-2 rounded-lg bg-slate-800">Payouts</Link>
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Vendor Payouts</h1>
            <Link href="/admin" className="text-sm text-slate-500">← Dashboard</Link>
          </div>

          <p className="text-sm text-slate-500 mb-4">
            Estimated balances are based on completed orders (total − delivery − service fee).
            B2C requires M-Pesa B2C credentials in env.
          </p>

          {loading && <div className="h-24 bg-white animate-pulse rounded-2xl" />}

          <h2 className="font-bold mb-2">Vendor balances</h2>
          <div className="space-y-2 mb-8">
            {balances.map((v) => (
              <div key={v.vendorId} className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="font-bold">{v.businessName}</p>
                  <p className="text-sm text-slate-500">
                    {v.phone} · {v.completedOrders} completed orders
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-primary-700">KES {v.estimatedBalance}</span>
                  <button
                    onClick={() => {
                      setSelected(v)
                      setAmount(String(v.estimatedBalance || ''))
                      setMsg('')
                    }}
                    className="btn-primary text-sm py-2 px-4"
                  >
                    Pay out
                  </button>
                </div>
              </div>
            ))}
          </div>

          {selected && (
            <div className="card p-4 mb-8 border-2 border-primary-300 space-y-3">
              <h3 className="font-bold">Payout: {selected.businessName}</h3>
              <div>
                <label className="text-sm font-medium">Amount (KES)</label>
                <input
                  type="number"
                  className="input mt-1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sendMpesa}
                  onChange={(e) => setSendMpesa(e.target.checked)}
                />
                Attempt M-Pesa B2C transfer (needs credentials)
              </label>
              {msg && <p className="text-sm text-slate-600">{msg}</p>}
              <div className="flex gap-2">
                <button onClick={() => setSelected(null)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button onClick={createPayout} disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Processing…' : 'Create payout'}
                </button>
              </div>
            </div>
          )}

          <h2 className="font-bold mb-2">Payout history</h2>
          <div className="space-y-2">
            {payouts.length === 0 && !loading && (
              <div className="card p-6 text-center text-slate-500">No payouts yet</div>
            )}
            {payouts.map((p) => (
              <div key={p.id} className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="font-bold">{p.vendor?.businessName}</p>
                  <p className="text-sm text-slate-500">
                    KES {p.amount} · {p.status}
                    {p.mpesaRef && ` · Ref: ${p.mpesaRef}`}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(p.createdAt).toLocaleString('en-KE')}
                  </p>
                </div>
                {p.status === 'PENDING' && (
                  <button
                    onClick={() => markPaid(p.id)}
                    className="text-sm font-bold bg-green-100 text-green-700 px-3 py-1.5 rounded-lg"
                  >
                    Mark PAID
                  </button>
                )}
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
