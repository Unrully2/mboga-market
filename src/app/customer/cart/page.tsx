'use client'

import {
  useState,
  useEffect,
  useCallback,
} from 'react'

import Link from 'next/link'
import { BottomNav } from '@/components/layout/BottomNav'
import { useRouter } from 'next/navigation'

import {
  get,
  put,
  STORES,
} from '@/lib/offline/db'


interface CartItem {
  id: string
  vendorProductId: string
  name: string
  unit: string
  price: number
  quantity: number
  instructions?: string
  lineTotal: number
}


interface CartGroup {
  vendor: {
    id: string
    businessName: string
    deliveryFee: number
    minOrderAmount: number
    isOpen: boolean
    status?: string
  }

  items: CartItem[]

  subtotal: number
}


interface CachedCart {
  id: string
  groups: CartGroup[]
  subtotal: number
  cachedAt: string
}


const CART_CACHE_KEY =
  'customer:cart'


async function saveCartOffline(
  groups: CartGroup[],
  subtotal: number
) {
  const cached: CachedCart = {
    id: CART_CACHE_KEY,
    groups,
    subtotal,
    cachedAt:
      new Date().toISOString(),
  }

  await put(
    STORES.cart,
    cached
  )
}


async function getCachedCart(): Promise<
  CachedCart | null
> {
  try {
    const cached =
      await get<CachedCart>(
        STORES.cart,
        CART_CACHE_KEY
      )

    return cached || null
  } catch (error) {
    console.error(
      '[Mboga Offline] Failed to read cached cart:',
      error
    )

    return null
  }
}


export default function CartPage() {
  const router = useRouter()


  const [
    groups,
    setGroups,
  ] = useState<CartGroup[]>([])


  const [
    subtotal,
    setSubtotal,
  ] = useState(0)


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
   * Load the cart.
   *
   * ONLINE:
   *
   * API
   * ↓
   * React
   * ↓
   * IndexedDB
   *
   *
   * OFFLINE:
   *
   * IndexedDB
   * ↓
   * React
   */
  const loadCart =
    useCallback(
      async () => {
        setLoading(true)

        setError('')


        const browserOffline =
          typeof navigator !==
            'undefined'
            ? !navigator.onLine
            : false


        /*
         * If the browser is already
         * offline, do not waste time
         * attempting the API.
         */
        if (browserOffline) {
          const cached =
            await getCachedCart()


          if (cached) {
            setGroups(
              cached.groups
            )


            setSubtotal(
              cached.subtotal
            )


            setCachedAt(
              cached.cachedAt
            )


            setOffline(true)

            setLoading(false)

            return
          }


          setGroups([])

          setSubtotal(0)

          setOffline(true)


          setError(
            'Your cart has not been saved on this device yet.'
          )


          setLoading(false)

          return
        }


        try {
          const res =
            await fetch(
              '/api/cart',
              {
                credentials:
                  'include',

                cache:
                  'no-store',
              }
            )


          /*
           * Authentication is still
           * required for the real
           * server cart.
           */
          if (
            res.status ===
            401
          ) {
            router.push(
              '/login'
            )

            return
          }


          const data =
            await res.json()


          if (!res.ok) {
            throw new Error(
              data?.error ||
                'Failed to load cart'
            )
          }


          const nextGroups =
            data.groups ||
            []


          const nextSubtotal =
            Number(
              data.subtotal ||
                nextGroups.reduce(
                  (
                    total: number,
                    group: CartGroup
                  ) =>
                    total +
                    Number(
                      group.subtotal ||
                        0
                    ),
                  0
                )
            )


          setGroups(
            nextGroups
          )


          setSubtotal(
            nextSubtotal
          )


          /*
           * Save the successful
           * server response locally.
           */
          try {
            await saveCartOffline(
              nextGroups,
              nextSubtotal
            )


            setCachedAt(
              new Date().toISOString()
            )
          } catch (cacheError) {
            /*
             * A cache failure must
             * never break the cart.
             */
            console.error(
              '[Mboga Offline] Cart cache failed:',
              cacheError
            )
          }


          setOffline(false)

          setError('')
        } catch (e: any) {
          /*
           * Network failure:
           * fall back to IndexedDB.
           */
          const cached =
            await getCachedCart()


          if (cached) {
            setGroups(
              cached.groups
            )


            setSubtotal(
              cached.subtotal
            )


            setCachedAt(
              cached.cachedAt
            )


            setOffline(true)


            setError(
              'You are offline. Showing your last saved cart.'
            )
          } else {
            setGroups([])

            setSubtotal(0)

            setOffline(true)


            setError(
              e?.message ||
                'Failed to load cart.'
            )
          }
        } finally {
          setLoading(false)
        }
      },
      [router]
    )


  /*
   * Initial cart load.
   */
  useEffect(() => {
    void loadCart()
  }, [loadCart])


  /*
   * React to connection changes.
   */
  useEffect(() => {
    function handleOffline() {
      setOffline(true)

      setError(
        'You are offline. Showing your saved cart.'
      )
    }


    function handleOnline() {
      setOffline(false)

      setError('')

      /*
       * When connection returns,
       * the server becomes the
       * source of truth again.
       */
      void loadCart()
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
  }, [loadCart])


  /*
   * Change quantity.
   *
   * IMPORTANT:
   *
   * Offline PATCH mutations are
   * deliberately NOT sent yet.
   *
   * The synchronization queue is
   * the next layer.
   */
  async function updateQty(
    cartItemId: string,
    quantity: number
  ) {
    if (offline) {
      setError(
        'Reconnect before changing cart quantities.'
      )

      return
    }


    try {
      const res =
        await fetch(
          '/api/cart',
          {
            method:
              'PATCH',

            headers: {
              'Content-Type':
                'application/json',
            },

            credentials:
              'include',

            body:
              JSON.stringify({
                id:
                  cartItemId,

                quantity:
                  Number(
                    quantity
                  ),
              }),
          }
        )


      if (
        res.status ===
        401
      ) {
        router.push(
          '/login'
        )

        return
      }


      if (!res.ok) {
        const data =
          await res.json().catch(
            () => ({})
          )


        throw new Error(
          data?.error ||
            'Failed to update cart'
        )
      }


      await loadCart()
    } catch (e: any) {
      setError(
        e?.message ||
          'Failed to update cart'
      )
    }
  }


  /*
   * Remove cart item.
   */
  async function removeItem(
    cartItemId: string
  ) {
    if (offline) {
      setError(
        'Reconnect before removing items from the cart.'
      )

      return
    }


    try {
      const res =
        await fetch(
          `/api/cart?id=${encodeURIComponent(
            cartItemId
          )}`,
          {
            method:
              'DELETE',

            credentials:
              'include',
          }
        )


      if (
        res.status ===
        401
      ) {
        router.push(
          '/login'
        )

        return
      }


      if (!res.ok) {
        const data =
          await res.json().catch(
            () => ({})
          )


        throw new Error(
          data?.error ||
            'Failed to remove item'
        )
      }


      await loadCart()
    } catch (e: any) {
      setError(
        e?.message ||
          'Failed to remove item'
      )
    }
  }


  /*
   * Calculate whether a group
   * can proceed to checkout.
   */
  function getGroupTotal(
    group: CartGroup
  ) {
    const delivery =
      Number(
        group.vendor
          .deliveryFee || 50
      )


    const service =
      10


    return (
      Number(
        group.subtotal || 0
      ) +
      delivery +
      service
    )
  }


  /*
   * Loading screen.
   */
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">

        <div className="h-8 w-32 bg-slate-200 animate-pulse rounded mb-6" />

        <div className="space-y-4">

          {[1, 2].map(
            (i) => (
              <div
                key={i}
                className="h-32 bg-slate-200 animate-pulse rounded-2xl"
              />
            )
          )}

        </div>

      </div>
    )
  }


  return (
    <div className="min-h-screen bg-slate-50 pb-28">

      {/* Header */}

      <header className="bg-white sticky top-0 z-30 border-b border-slate-100 px-4 py-3 flex items-center gap-3">

        <Link
          href="/customer"
          className="text-2xl"
        >
          ←
        </Link>


        <h1 className="font-bold text-lg">
          Your Cart
        </h1>

      </header>


      {/* Offline banner */}

      {offline && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">

          <div className="flex items-start gap-2">

            <span className="text-amber-600">
              ⚡
            </span>


            <div>

              <p className="text-xs font-bold text-amber-800">
                OFFLINE MODE
              </p>


              <p className="text-xs text-amber-700">
                Showing the last cart saved
                on this device.
              </p>


              {cachedAt && (
                <p className="text-[10px] text-amber-600 mt-1">
                  Saved:{' '}
                  {new Date(
                    cachedAt
                  ).toLocaleString()}
                </p>
              )}

            </div>

          </div>

        </div>
      )}


      <main className="p-4 space-y-4">

        {/* Error */}

        {error && (
          <div className="card p-4 text-red-600 text-center text-sm">

            {error}

          </div>
        )}


        {/* Empty cart */}

        {groups.length ===
          0 &&
          !error && (
            <div className="card p-10 text-center">

              <p className="text-5xl mb-3">
                🛒
              </p>


              <p className="font-medium text-lg">
                Your cart is empty
              </p>


              <p className="text-sm text-slate-500 mt-1 mb-6">
                Browse nearby mama mbogas
                and add fresh produce
              </p>


              <Link
                href="/customer"
                className="btn-primary inline-block"
              >
                Shop Fresh Produce
              </Link>

            </div>
          )}


        {/* Cart groups */}

        {groups.map(
          (group) => {
            const delivery =
              Number(
                group.vendor
                  .deliveryFee ||
                  50
              )


            const service =
              10


            const total =
              getGroupTotal(
                group
              )


            const belowMin =
              Number(
                group.subtotal ||
                  0
              ) <
              Number(
                group.vendor
                  .minOrderAmount ||
                  0
              )


            return (
              <div
                key={
                  group.vendor.id
                }
                className="card overflow-hidden"
              >

                {/* Vendor header */}

                <div className="bg-primary-50 px-4 py-3 flex items-center justify-between">

                  <div>

                    <p className="font-bold">
                      {
                        group.vendor
                          .businessName
                      }
                    </p>


                    {!group.vendor
                      .isOpen && (
                      <p className="text-xs text-red-600 font-medium">
                        Currently closed
                      </p>
                    )}

                  </div>


                  <Link
                    href={`/customer/vendor/${group.vendor.id}`}
                    className="text-sm text-primary-600 font-medium"
                  >
                    Add more
                  </Link>

                </div>


                {/* Items */}

                <div className="divide-y divide-slate-100">

                  {group.items.map(
                    (item) => (
                      <div
                        key={
                          item.id
                        }
                        className="p-4 flex gap-3"
                      >

                        <div className="flex-1">

                          <p className="font-semibold">
                            {
                              item.name
                            }
                          </p>


                          <p className="text-xs text-slate-500">
                            {
                              item.unit
                            }

                            {' · '}

                            KES{' '}
                            {
                              item.price
                            }
                          </p>


                          {item.instructions && (
                            <p className="text-xs text-accent-600 mt-0.5">
                              📝{' '}
                              {
                                item.instructions
                              }
                            </p>
                          )}


                          <div className="flex items-center gap-3 mt-2">

                            <button
                              onClick={() =>
                                void updateQty(
                                  item.id,
                                  item.quantity -
                                    1
                                )
                              }
                              disabled={
                                offline ||
                                item.quantity <=
                                  1
                              }
                              className="w-8 h-8 rounded-full border border-slate-200 font-bold disabled:opacity-40"
                            >
                              −
                            </button>


                            <span className="font-semibold w-6 text-center">
                              {
                                item.quantity
                              }
                            </span>


                            <button
                              onClick={() =>
                                void updateQty(
                                  item.id,
                                  item.quantity +
                                    1
                                )
                              }
                              disabled={
                                offline
                              }
                              className="w-8 h-8 rounded-full border border-slate-200 font-bold disabled:opacity-40"
                            >
                              +
                            </button>


                            <button
                              onClick={() =>
                                void removeItem(
                                  item.id
                                )
                              }
                              disabled={
                                offline
                              }
                              className="text-xs text-red-500 ml-2 disabled:opacity-40"
                            >
                              Remove
                            </button>

                          </div>

                        </div>


                        <p className="font-bold text-primary-700">
                          KES{' '}
                          {
                            item.lineTotal
                          }
                        </p>

                      </div>
                    )
                  )}

                </div>


                {/* Totals */}

                <div className="px-4 py-3 bg-slate-50 space-y-1 text-sm">

                  <div className="flex justify-between">

                    <span>
                      Subtotal
                    </span>

                    <span>
                      KES{' '}
                      {
                        group.subtotal
                      }
                    </span>

                  </div>


                  <div className="flex justify-between">

                    <span>
                      Delivery
                    </span>

                    <span>
                      KES{' '}
                      {
                        delivery
                      }
                    </span>

                  </div>


                  <div className="flex justify-between">

                    <span>
                      Service fee
                    </span>

                    <span>
                      KES{' '}
                      {
                        service
                      }
                    </span>

                  </div>


                  <div className="flex justify-between font-bold text-base pt-1 border-t border-slate-200">

                    <span>
                      Total
                    </span>

                    <span className="text-primary-700">
                      KES{' '}
                      {
                        total
                      }
                    </span>

                  </div>

                </div>


                {/* Minimum order */}

                {belowMin && (
                  <div className="px-4 py-2 bg-amber-50 text-amber-700 text-sm">

                    Minimum order is KES{' '}

                    {
                      group.vendor
                        .minOrderAmount
                    }

                    . Add more items.

                  </div>
                )}


                {/* Checkout */}

                <div className="p-4">

                  {offline ? (
                    <button
                      disabled
                      className="btn-primary w-full disabled:opacity-50"
                    >
                      Reconnect to Checkout
                    </button>
                  ) : (
                    <button
                      disabled={
                        belowMin ||
                        !group.vendor
                          .isOpen
                      }
                      onClick={() =>
                        router.push(
                          `/customer/checkout?vendorId=${group.vendor.id}`
                        )
                      }
                      className="btn-primary w-full disabled:opacity-50"
                    >
                      {!group.vendor
                        .isOpen
                        ? 'Vendor Closed'
                        : belowMin
                          ? `Min KES ${group.vendor.minOrderAmount}`
                          : `Checkout · KES ${total}`}
                    </button>
                  )}

                </div>

              </div>
            )
          }
        )}

      </main>


      {/* Bottom nav */}

      <BottomNav
        role="CUSTOMER"
      />

    </div>
  )
}
