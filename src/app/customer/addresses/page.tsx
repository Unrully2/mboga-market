'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BottomNav } from '@/components/layout/BottomNav'
import { useRouter } from 'next/navigation'

// Common Kiambu / nearby estates for quick select
const ESTATES = [
  'Kiambu Town',
  'Thindigua',
  'Ruiru',
  'Ndumberi',
  'Tinganga',
  'Riabai',
  'Kanunga',
  'Githunguri',
  'Limuru',
  'Other',
]

export default function AddressesPage() {
  const router = useRouter()
  const [addresses, setAddresses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [label, setLabel] = useState('Home')
  const [estate, setEstate] = useState('Kiambu Town')
  const [street, setStreet] = useState('')
  const [landmark, setLandmark] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)

  async function load() {
    try {
      const res = await fetch('/api/addresses')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      const data = await res.json()
      setAddresses(data.addresses || [])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function useGps() {
    if (!navigator.geolocation) {
      setError('GPS not supported on this device')
      return
    }
    setGpsLoading(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude)
        setLng(pos.coords.longitude)
        setGpsLoading(false)
      },
      () => {
        setError('Could not get location. Allow location access or enter estate manually.')
        setGpsLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label,
          estate,
          street,
          landmark,
          latitude: lat,
          longitude: lng,
          isDefault: addresses.length === 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed')
        return
      }
      setShowForm(false)
      setStreet('')
      setLandmark('')
      setLat(null)
      setLng(null)
      await load()
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function setDefault(id: string) {
    await fetch(`/api/addresses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDefault: true }),
    })
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this address?')) return
    await fetch(`/api/addresses/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <header className="bg-white sticky top-0 z-30 border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <Link href="/customer/account" className="text-2xl">←</Link>
        <h1 className="font-bold text-lg">Delivery addresses</h1>
      </header>

      <main className="p-4 space-y-4">
        {loading && <div className="h-20 bg-slate-200 animate-pulse rounded-2xl" />}

        {addresses.map((a) => (
          <div key={a.id} className="card p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold">
                  {a.label}
                  {a.isDefault && (
                    <span className="ml-2 text-[10px] bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded">
                      DEFAULT
                    </span>
                  )}
                </p>
                <p className="text-sm text-slate-600 mt-0.5">
                  {a.estate}
                  {a.street ? `, ${a.street}` : ''}
                </p>
                {a.landmark && <p className="text-xs text-slate-400">{a.landmark}</p>}
                {a.latitude && (
                  <p className="text-xs text-slate-400 mt-1">
                    📍 {a.latitude.toFixed(4)}, {a.longitude?.toFixed(4)}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {!a.isDefault && (
                  <button
                    onClick={() => setDefault(a.id)}
                    className="text-xs text-primary-600 font-medium"
                  >
                    Set default
                  </button>
                )}
                <button onClick={() => remove(a.id)} className="text-xs text-red-500">
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}

        {!loading && addresses.length === 0 && !showForm && (
          <div className="card p-8 text-center text-slate-500">
            <p className="text-4xl mb-2">📍</p>
            <p>No addresses yet</p>
          </div>
        )}

        {showForm ? (
          <form onSubmit={save} className="card p-4 space-y-3">
            <h2 className="font-bold">Add address</h2>
            <div>
              <label className="text-sm font-medium">Label</label>
              <input
                className="input mt-1"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Home, Work…"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Estate / Area</label>
              <select
                className="input mt-1"
                value={estate}
                onChange={(e) => setEstate(e.target.value)}
              >
                {ESTATES.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Street / Building (optional)</label>
              <input
                className="input mt-1"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="Near Kiambu Hospital"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Landmark (optional)</label>
              <input
                className="input mt-1"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="Opposite Shell"
              />
            </div>

            <button
              type="button"
              onClick={useGps}
              disabled={gpsLoading}
              className="btn-secondary w-full text-sm"
            >
              {gpsLoading
                ? 'Getting GPS…'
                : lat
                ? `✓ GPS set (${lat.toFixed(4)}, ${lng?.toFixed(4)})`
                : '📍 Use my current GPS location'}
            </button>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className="flex-1 btn-primary">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        ) : (
          <button onClick={() => setShowForm(true)} className="btn-primary w-full">
            + Add address
          </button>
        )}
      </main>
          <BottomNav role="CUSTOMER" />
    </div>
  )
}
