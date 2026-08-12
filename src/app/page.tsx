import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🥬</span>
            <span className="font-bold text-xl text-primary-700">Mboga Market</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#how" className="hover:text-primary-600">How it works</a>
            <a href="#vendors" className="hover:text-primary-600">Vendors</a>
            <Link href="/login" className="hover:text-primary-600">Log in</Link>
            <Link href="/register" className="btn-primary text-sm py-2 px-4">
              Get Started
            </Link>
          </nav>
          <Link href="/login" className="md:hidden btn-primary text-sm py-2 px-4">
            Login
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary-50 to-white">
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-primary-600 font-semibold mb-3">Fresh from your neighbourhood</p>
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 leading-tight mb-4">
              Fresh produce from mama mbogas, delivered to your door
            </h1>
            <p className="text-lg text-slate-600 mb-8">
              Shop from trusted local greengrocers in Kiambu. Pay with M-Pesa or cash. Track your boda delivery in real time.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/customer" className="btn-primary text-center">
                🛒 Shop Fresh Produce
              </Link>
              <Link href="/register?role=vendor" className="btn-secondary text-center">
                Become a Vendor
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1">✓ Verified Vendors</span>
              <span className="flex items-center gap-1">✓ Secure M-Pesa</span>
              <span className="flex items-center gap-1">✓ Tracked Delivery</span>
            </div>
          </div>
          <div className="relative">
            <div className="card p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-2xl">👩‍🌾</div>
                <div>
                  <p className="font-bold">Mama Jane Fresh Greens</p>
                  <p className="text-sm text-slate-500">⭐ 4.8 · 0.8 km · 20–30 min</p>
                </div>
                <span className="ml-auto text-xs font-semibold bg-green-100 text-green-700 px-2 py-1 rounded-full">OPEN</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { name: 'Tomatoes', price: 'KES 20', emoji: '🍅' },
                  { name: 'Sukuma', price: 'KES 20', emoji: '🥬' },
                  { name: 'Cabbage', price: 'KES 80', emoji: '🥬' },
                ].map((p) => (
                  <div key={p.name} className="bg-slate-50 rounded-xl p-3 text-center">
                    <div className="text-3xl mb-1">{p.emoji}</div>
                    <p className="text-xs font-medium">{p.name}</p>
                    <p className="text-xs text-primary-600 font-bold">{p.price}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Find nearby vendors', desc: 'Enter your estate or use GPS. See mama mbogas within delivery range.' },
              { step: '2', title: 'Add fresh produce', desc: 'Browse tomatoes, sukuma, potatoes… Add special instructions (chopped, washed).' },
              { step: '3', title: 'Pay & track', desc: 'M-Pesa STK or cash on delivery. Follow your order from market to door.' },
            ].map((s) => (
              <div key={s.step} className="card p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-primary-600 text-white font-bold text-xl flex items-center justify-center mx-auto mb-4">
                  {s.step}
                </div>
                <h3 className="font-bold text-lg mb-2">{s.title}</h3>
                <p className="text-slate-600 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-12">
        <div className="max-w-6xl mx-auto px-4 flex flex-wrap justify-center gap-8 text-center">
          {[
            { icon: '✓', label: 'Verified Vendors' },
            { icon: '🔒', label: 'Secure Payments' },
            { icon: '🌱', label: 'Fresh Produce' },
            { icon: '🛵', label: 'Tracked Deliveries' },
            { icon: '⭐', label: 'Customer Reviews' },
          ].map((t) => (
            <div key={t.label} className="flex flex-col items-center gap-1">
              <span className="text-2xl">{t.icon}</span>
              <span className="text-sm font-medium text-slate-700">{t.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary-600 text-white">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to taste the difference?</h2>
          <p className="mb-8 opacity-90">Join customers in Kiambu ordering fresh produce the easy way.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/customer" className="bg-white text-primary-700 font-bold py-3 px-8 rounded-xl">
              Start Shopping
            </Link>
            <Link href="/register?role=vendor" className="border-2 border-white font-bold py-3 px-8 rounded-xl">
              Sell on Mboga Market
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 text-white font-bold text-lg mb-3">
              <span>🥬</span> Mboga Market
            </div>
            <p className="text-sm">Fresh from your neighbourhood.</p>
          </div>
          <div>
            <p className="font-semibold text-white mb-2">For Customers</p>
            <ul className="text-sm space-y-1">
              <li><Link href="/customer">Shop</Link></li>
              <li><Link href="/login">Login</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-white mb-2">For Partners</p>
            <ul className="text-sm space-y-1">
              <li><Link href="/register?role=vendor">Become a Vendor</Link></li>
              <li><Link href="/register?role=rider">Become a Rider</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-white mb-2">Pilot</p>
            <p className="text-sm">Kiambu Town · Expanding soon to Ruiru, Thika & Nairobi</p>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 mt-8 pt-8 border-t border-slate-700 text-sm text-center">
          © {new Date().getFullYear()} Mboga Market. Built for Kenya.
        </div>
      </footer>
    </div>
  )
}
