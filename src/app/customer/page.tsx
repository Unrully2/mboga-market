'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

import {
  MapPin,
  Search,
  Leaf,
  WifiOff,
} from 'lucide-react'

import { BottomNav } from '@/components/layout/BottomNav'
import { AccountMenu } from '@/components/layout/AccountMenu'
import { useAuth } from '@/hooks/useAuth'
import { ErrorBanner } from '@/components/ui/ErrorBanner'

import {
  get,
  put,
  STORES,
} from '@/lib/offline/db'


interface Vendor {
  id: string
  businessName: string
  ownerName?: string
  rating: number
  totalReviews: number
  distance: number | null
  estimatedTime: string
  deliveryFee: number
  minOrderAmount?: number
  isOpen: boolean
  isVerified: boolean
  location?: string
  estate?: string
  profileImage?: string
  productCount?: number
  latitude?: number
  longitude?: number
}


interface CachedVendors {
  id: string
  vendors: Vendor[]
  latitude: number
  longitude: number
  cachedAt: string
}


const CATEGORIES = [
  {
    name: 'Vegetables',
    icon: Leaf,
    slug: 'vegetables',
    color: 'bg-green-100 text-green-700',
  },
  {
    name: 'Fruits',
    icon: Leaf,
    slug: 'fruits',
    color: 'bg-red-100 text-red-700',
  },
  {
    name: 'Roots',
    icon: Leaf,
    slug: 'roots-tubers',
    color: 'bg-amber-100 text-amber-700',
  },
  {
    name: 'Spices',
    icon: Leaf,
    slug: 'spices',
    color: 'bg-orange-100 text-orange-700',
  },
  {
    name: 'Avocados',
    icon: Leaf,
    slug: 'avocado',
    color: 'bg-emerald-100 text-emerald-700',
  },
  {
    name: 'Bananas',
    icon: Leaf,
    slug: 'bananas',
    color: 'bg-yellow-100 text-yellow-700',
  },
]


const DEFAULT_LAT = -1.1714
const DEFAULT_LNG = 36.8356


/*
 * Each customer's vendor cache is kept
 * separately from other offline data.
 *
 * Vendors are public marketplace data,
 * but the cache is still explicitly
 * controlled by the application.
 */
const VENDOR_CACHE_KEY =
  'customer:vendors:nearby'


async function saveVendorCache(
  vendors: Vendor[],
  latitude: number,
  longitude: number
) {
  const cached: CachedVendors = {
    id: VENDOR_CACHE_KEY,

    vendors,

    latitude,

    longitude,

    cachedAt:
      new Date().toISOString(),
  }


  await put(
    STORES.products,
    cached
  )
}


async function getVendorCache(): Promise<
  CachedVendors | null
> {
  try {
    const cached =
      await get<CachedVendors>(
        STORES.products,
        VENDOR_CACHE_KEY
      )

    return cached || null
  } catch {
    return null
  }
}


export default function CustomerHome() {
  const {
    user,
    loading: authLoading,
    logout,
  } = useAuth({
    requiredRole: 'CUSTOMER',
  })


  const [
    location,
    setLocation,
  ] = useState(
    'Kiambu Town'
  )


  const [
    vendors,
    setVendors,
  ] = useState<Vendor[]>([])


  const [
    loading,
    setLoading,
  ] = useState(true)


  const [
    error,
    setError,
  ] = useState('')


  const [
    offline,
    setOffline,
  ] = useState(false)


  const [
    cachedAt,
    setCachedAt,
  ] = useState<
    string | null
  >(null)


  /*
   * Load the customer's saved
   * default address.
   *
   * If this fails offline,
   * we simply keep Kiambu Town.
   */
  async function loadAddress() {
    let lat =
      DEFAULT_LAT

    let lng =
      DEFAULT_LNG

    let locLabel =
      'Kiambu Town'


    try {
      const addressResponse =
        await fetch(
          '/api/addresses',
          {
            credentials:
              'include',

            cache:
              'no-store',
          }
        )


      if (
        addressResponse.ok
      ) {
        const addressData =
          await addressResponse.json()


        const addresses =
          Array.isArray(
            addressData.addresses
          )
            ? addressData.addresses
            : []


        const defaultAddress =
          addresses.find(
            (
              address: any
            ) =>
              address.isDefault
          ) ||
          addresses[0]


        if (
          defaultAddress
        ) {
          locLabel =
            defaultAddress.estate ||
            defaultAddress.location ||
            locLabel


          if (
            defaultAddress.latitude !=
              null &&
            defaultAddress.longitude !=
              null
          ) {
            lat =
              Number(
                defaultAddress.latitude
              )

            lng =
              Number(
                defaultAddress.longitude
              )
          }
        }
      }
    } catch {
      /*
       * Offline or unavailable.
       *
       * Use the default pilot location.
       */
    }


    setLocation(
      locLabel
    )


    return {
      lat,
      lng,
    }
  }


  /*
   * Load nearby vendors.
   *
   * Online:
   *   API → UI → IndexedDB
   *
   * Offline:
   *   IndexedDB → UI
   */
  async function loadVendors(
    lat: number,
    lng: number
  ) {
    try {
      const response =
        await fetch(
          `/api/vendors?lat=${lat}&lng=${lng}&radius=50&sort=nearest`,
          {
            credentials:
              'include',

            cache:
              'no-store',
          }
        )


      if (
        !response.ok
      ) {
        throw new Error(
          'Could not load vendors.'
        )
      }


      const data =
        await response.json()


      const nextVendors =
        Array.isArray(
          data.vendors
        )
          ? data.vendors
          : []


      setVendors(
        nextVendors
      )


      /*
       * Save the successful
       * server response.
       */
      await saveVendorCache(
        nextVendors,
        lat,
        lng
      )


      setCachedAt(
        new Date().toISOString()
      )


      setOffline(false)

      setError('')
    } catch {
      /*
       * Network failed.
       *
       * Use the most recent
       * locally cached vendors.
       */
      const cached =
        await getVendorCache()


      if (cached) {
        setVendors(
          cached.vendors
        )


        setCachedAt(
          cached.cachedAt
        )


        setOffline(true)


        setError(
          'You are offline. Showing the vendors saved on this device.'
        )


        return
      }


      setVendors([])

      setOffline(true)

      setError(
        'You are offline and no saved vendors are available yet.'
      )
    }
  }


  /*
   * Main loading process.
   */
  async function load() {
    try {
      setLoading(true)

      setError('')


      const online =
        typeof navigator ===
          'undefined'
          ? true
          : navigator.onLine


      /*
       * Get location.
       *
       * This is allowed to fail.
       */
      const {
        lat,
        lng,
      } =
        await loadAddress()


      /*
       * If browser already knows
       * it is offline, don't waste
       * time attempting the API.
       */
      if (!online) {
        const cached =
          await getVendorCache()


        if (cached) {
          setVendors(
            cached.vendors
          )


          setCachedAt(
            cached.cachedAt
          )


          setOffline(true)


          setError(
            'You are offline. Showing the vendors saved on this device.'
          )


          return
        }


        setVendors([])

        setOffline(true)

        setError(
          'You are offline and no saved vendors are available yet.'
        )


        return
      }


      await loadVendors(
        lat,
        lng
      )
    } catch {
      const cached =
        await getVendorCache()


      if (cached) {
        setVendors(
          cached.vendors
        )


        setCachedAt(
          cached.cachedAt
        )


        setOffline(true)


        setError(
          'Connection unavailable. Showing saved vendors.'
        )
      } else {
        setError(
          'Could not load vendors.'
        )
      }
    } finally {
      setLoading(false)
    }
  }


  /*
   * Initial load.
   */
  useEffect(() => {
    void load()
  }, [])


  /*
   * React to connection changes.
   */
  useEffect(() => {
    function handleOffline() {
      setOffline(true)

      setError(
        'You are offline. Showing saved marketplace data.'
      )
    }


    function handleOnline() {
      setOffline(false)

      setError('')

      void load()
    }


    window.addEventListener(
      'offline',
      handleOffline
    )


    window.addEventListener(
      'online',
      handleOnline
    )


    return () => {
      window.removeEventListener(
        'offline',
        handleOffline
      )


      window.removeEventListener(
        'online',
        handleOnline
      )
    }
  }, [])


  const filtered =
    vendors


  return (
    <div className="min-h-screen bg-slate-50 pb-24">

      <header className="bg-white sticky top-0 z-40 border-b border-slate-100">

        <div className="px-4 py-3">

          <div className="flex items-center justify-between mb-3">

            <div>

              <p className="text-xs text-slate-500">
                Deliver to
              </p>


              <button
                type="button"
                className="font-semibold text-slate-900 flex items-center gap-1.5"
              >
                <MapPin className="w-4 h-4 text-primary-600" />

                {location}

                <span className="text-primary-600 text-sm">
                  ▾
                </span>
              </button>

            </div>


            <div className="flex items-center gap-2">

              {offline && (
                <div
                  className="flex items-center gap-1 text-amber-600"
                  title="Offline"
                >
                  <WifiOff className="w-4 h-4" />

                  <span className="text-[11px] font-semibold">
                    OFFLINE
                  </span>
                </div>
              )}


              {!authLoading &&
                user && (
                  <AccountMenu
                    user={user}
                    onLogout={logout}
                  />
                )}

            </div>

          </div>


          <Link
            href="/customer/search"
            className="flex items-center gap-2 w-full px-4 py-3 rounded-xl bg-slate-100 text-slate-500 text-sm"
          >
            <Search className="w-4 h-4" />

            Search vegetables,
            fruits…
          </Link>

        </div>

      </header>


      <main className="px-4 py-4 space-y-6">

        {offline && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">

            <div className="flex items-center gap-2">

              <WifiOff className="w-4 h-4 text-amber-600" />

              <p className="text-sm font-semibold text-amber-800">
                Offline mode
              </p>

            </div>


            <p className="text-xs text-amber-700 mt-1">
              You can browse the vendors
              saved on this device.
              Changes will synchronize
              when the connection returns.
            </p>


            {cachedAt && (
              <p className="text-[10px] text-amber-600 mt-2">
                Last saved:{' '}
                {new Date(
                  cachedAt
                ).toLocaleString()}
              </p>
            )}

          </div>
        )}


        <section>

          <h2 className="font-semibold text-slate-900 mb-3">
            What are you looking for?
          </h2>


          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">

            {CATEGORIES.map(
              (
                cat
              ) => {
                const Icon =
                  cat.icon


                return (
                  <Link
                    key={
                      cat.slug
                    }
                    href={`/customer/search?category=${cat.slug}`}
                    className="flex flex-col items-center gap-1.5 min-w-[72px]"
                  >

                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center ${cat.color}`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>


                    <span className="text-xs font-medium text-slate-700 text-center">
                      {
                        cat.name
                      }
                    </span>

                  </Link>
                )
              }
            )}

          </div>

        </section>


        <section>

          <div className="flex items-center justify-between mb-3">

            <h2 className="font-semibold text-slate-900">
              Nearby vendors
            </h2>


            <Link
              href="/customer/search"
              className="text-sm text-primary-600 font-medium flex items-center gap-0.5"
            >
              See all

              <Search className="w-3.5 h-3.5" />
            </Link>

          </div>


          {error &&
            !loading && (
              <ErrorBanner
                message={
                  error
                }
                onRetry={() =>
                  void load()
                }
              />
            )}


          {loading && (
            <div className="space-y-3">

              {[1, 2, 3].map(
                (
                  i
                ) => (
                  <div
                    key={i}
                    className="card p-4 flex gap-3"
                  >

                    <div className="w-16 h-16 rounded-xl bg-slate-200 animate-pulse shrink-0" />

                    <div className="flex-1 space-y-2">

                      <div className="h-4 bg-slate-200 animate-pulse rounded w-3/4" />

                      <div className="h-3 bg-slate-200 animate-pulse rounded w-1/2" />

                    </div>

                  </div>
                )
              )}

            </div>
          )}


          {!loading &&
            filtered.length ===
              0 &&
            !error && (
              <div className="card p-8 text-center">

                <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-3">

                  <Leaf className="w-7 h-7 text-primary-500" />

                </div>


                <p className="font-medium text-slate-800">
                  No vendors nearby
                </p>


                <p className="text-sm text-slate-500 mt-1">
                  Try expanding your
                  search or check back
                  later.
                </p>

              </div>
            )}


          {!loading &&
            filtered.length >
              0 && (
              <div className="space-y-3">

                {filtered.map(
                  (
                    v
                  ) => (

                    <Link
                      key={
                        v.id
                      }
                      href={`/customer/vendor/${v.id}`}
                      className="card p-4 flex gap-3 active:scale-[0.99] transition block hover:shadow-md"
                    >

                      <div className="w-16 h-16 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">

                        {v.profileImage ? (
                          <img
                            src={
                              v.profileImage
                            }
                            alt={
                              v.businessName
                            }
                            className="w-full h-full rounded-xl object-cover"
                          />
                        ) : (
                          <Leaf className="w-8 h-8 text-primary-600" />
                        )}

                      </div>


                      <div className="flex-1 min-w-0">

                        <div className="flex items-start justify-between gap-2">

                          <p className="font-bold text-slate-900 truncate">
                            {
                              v.businessName
                            }
                          </p>


                          {v.isVerified && (
                            <span className="text-[10px] bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded font-semibold flex-shrink-0">
                              VERIFIED
                            </span>
                          )}

                        </div>


                        <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">

                          <span className="inline-flex items-center gap-0.5">
                            <span className="text-amber-500">
                              ★
                            </span>

                            {Number(
                              v.rating ||
                                0
                            ).toFixed(
                              1
                            )}
                          </span>


                          <span>
                            ·
                          </span>


                          <span className="inline-flex items-center gap-0.5">

                            <MapPin className="w-3 h-3" />

                            {v.distance !=
                            null
                              ? `${v.distance} km`
                              : 'Nearby'}

                          </span>


                          <span>
                            ·
                          </span>


                          <span>
                            {v.estimatedTime ||
                              'Available'}
                          </span>

                        </p>


                        <div className="flex items-center gap-2 mt-1.5">

                          <span className="text-xs text-slate-500">
                            From KES{' '}
                            {
                              v.deliveryFee
                            }{' '}
                            delivery
                          </span>


                          <span
                            className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                              v.isOpen
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {v.isOpen
                              ? 'OPEN'
                              : 'CLOSED'}
                          </span>

                        </div>

                      </div>

                    </Link>

                  )
                )}

              </div>
            )}

        </section>

      </main>


      <BottomNav
        role="CUSTOMER"
      />

    </div>
  )
}
