'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function AdminCategoriesPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'categories' | 'products'>('categories')

  // New category form
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('🥬')
  const [saving, setSaving] = useState(false)

  // New product form
  const [pName, setPName] = useState('')
  const [pUnit, setPUnit] = useState('1 bunch')
  const [pCat, setPCat] = useState('')
  const [pPrice, setPPrice] = useState('20')

  async function load() {
    try {
      const [c, p] = await Promise.all([
        fetch('/api/admin/categories').then((r) => r.json()),
        fetch('/api/admin/products').then((r) => r.json()),
      ])
      if (c.error || p.error) {
        router.push('/login')
        return
      }
      setCategories(c.categories || [])
      setProducts(p.products || [])
      if (!pCat && c.categories?.[0]) setPCat(c.categories[0].id)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, icon }),
    })
    setName('')
    setSaving(false)
    load()
  }

  async function toggleCategory(id: string, isActive: boolean) {
    await fetch('/api/admin/categories', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive: !isActive }),
    })
    load()
  }

  async function addProduct(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: pName,
        unit: pUnit,
        categoryId: pCat,
        basePrice: Number(pPrice),
      }),
    })
    setPName('')
    setSaving(false)
    load()
  }

  async function toggleProduct(id: string, isActive: boolean) {
    await fetch('/api/admin/products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive: !isActive }),
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
            <Link href="/admin/categories" className="block px-3 py-2 rounded-lg bg-slate-800">Catalog</Link>
            <Link href="/admin/payouts" className="block px-3 py-2 rounded-lg hover:bg-slate-800">Payouts</Link>
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Catalog</h1>
            <Link href="/admin" className="text-sm text-slate-500">← Dashboard</Link>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setTab('categories')}
              className={`px-4 py-2 rounded-full text-sm font-semibold ${
                tab === 'categories' ? 'bg-primary-600 text-white' : 'bg-white'
              }`}
            >
              Categories
            </button>
            <button
              onClick={() => setTab('products')}
              className={`px-4 py-2 rounded-full text-sm font-semibold ${
                tab === 'products' ? 'bg-primary-600 text-white' : 'bg-white'
              }`}
            >
              Products
            </button>
          </div>

          {loading && <div className="h-24 bg-white animate-pulse rounded-2xl" />}

          {tab === 'categories' && !loading && (
            <div className="space-y-4">
              <form onSubmit={addCategory} className="card p-4 flex flex-wrap gap-2 items-end">
                <div>
                  <label className="text-xs font-medium">Icon</label>
                  <input className="input w-16" value={icon} onChange={(e) => setIcon(e.target.value)} />
                </div>
                <div className="flex-1 min-w-[160px]">
                  <label className="text-xs font-medium">Name</label>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Vegetables" />
                </div>
                <button type="submit" disabled={saving} className="btn-primary">
                  Add category
                </button>
              </form>

              {categories.map((c) => (
                <div key={c.id} className="card p-4 flex justify-between items-center">
                  <div>
                    <span className="text-xl mr-2">{c.icon}</span>
                    <span className="font-bold">{c.name}</span>
                    <span className="text-sm text-slate-500 ml-2">
                      {c._count?.products || 0} products
                    </span>
                  </div>
                  <button
                    onClick={() => toggleCategory(c.id, c.isActive)}
                    className={`text-xs font-bold px-3 py-1 rounded-full ${
                      c.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {c.isActive ? 'Active' : 'Inactive'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === 'products' && !loading && (
            <div className="space-y-4">
              <form onSubmit={addProduct} className="card p-4 grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">Name</label>
                  <input className="input" value={pName} onChange={(e) => setPName(e.target.value)} required placeholder="Sukuma Wiki" />
                </div>
                <div>
                  <label className="text-xs font-medium">Unit</label>
                  <input className="input" value={pUnit} onChange={(e) => setPUnit(e.target.value)} required />
                </div>
                <div>
                  <label className="text-xs font-medium">Category</label>
                  <select className="input" value={pCat} onChange={(e) => setPCat(e.target.value)}>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Base price (KES)</label>
                  <input type="number" className="input" value={pPrice} onChange={(e) => setPPrice(e.target.value)} />
                </div>
                <button type="submit" disabled={saving} className="btn-primary sm:col-span-2">
                  Add product to catalog
                </button>
              </form>

              {products.map((p) => (
                <div key={p.id} className="card p-4 flex justify-between items-center">
                  <div>
                    <p className="font-bold">{p.name}</p>
                    <p className="text-sm text-slate-500">
                      {p.unit} · KES {p.basePrice} · {p.category?.name} · {p._count?.vendorProducts || 0} vendors
                    </p>
                  </div>
                  <button
                    onClick={() => toggleProduct(p.id, p.isActive)}
                    className={`text-xs font-bold px-3 py-1 rounded-full ${
                      p.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {p.isActive ? 'Active' : 'Inactive'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
