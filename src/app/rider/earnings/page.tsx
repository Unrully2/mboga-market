'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BottomNav } from '@/components/layout/BottomNav'
import { useRouter } from 'next/navigation'

export default function RiderEarningsPage() {
  const router = useRouter()
  const [history, setHistory] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/deliveries?type=history')
        if (res.status === 401) {
          router.push('/login')
          return
        }
        const data = await res.json()
        const list = data.deliveries || []
        setHistory(list)
        setTotal(list.reduce((s: number, d: any) => s + (d.earnings || 0), 0))
      } catch {
        /* ignore */
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  return (
    <div className="min-h-screen bg-slate-100 pb-24">
      <header className="bg-slate-800 text-white p-4 flex items-center gap-3">
        <Link href="/rider" className="text-2xl">←</Link>
        <h1 className="text-xl font-bold">Earnings</h1>
      </header>

      <main className="p-4 space-y-4">
        <div className="card p-6 text-center">
          <p className="text-sm text-slate-500">Total earned</p>
          <p className="text-3xl font-bold text-green-600">KES {total}</p>
          <p className="text-xs text-slate-400 mt-1">{history.length} deliveries</p>
        </div>

        {loading && <div className="h-20 bg-white animate-pulse rounded-2xl" />}

        {!loading && history.length === 0 && (
          <div className="card p-8 text-center text-slate-500">
            <p>No completed deliveries yet</p>
          </div>
        )}

        {history.map((d) => (
          <div key={d.id} className="card p-4 flex justify-between items-center">
            <div>
              <p className="font-semibold">{d.orderNumber}</p>
              <p className="text-sm text-slate-500">
                {d.vendor} → {d.customer}
              </p>
              <p className="text-xs text-slate-400">
                {d.deliveredAt ? new Date(d.deliveredAt).toLocaleString('en-KE') : ''}
              </p>
            </div>
            <p className="font-bold text-green-600">+KES {d.earnings}</p>
          </div>
        ))}
      </main>

      <BottomNav role="RIDER" />
    </div>
  )
}
