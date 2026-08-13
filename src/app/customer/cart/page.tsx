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

import { createClient } from '@/lib/supabase/client'


interface CartItem {
  id: string

  vendorProductId: string

  name: string

  unit: string

  price: number

  quantity: number

  instructions?: string

  lineTotal: number

  image?: string

  stockStatus?: string
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


interface CartResponse {
  groups: CartGroup[]

  subtotal?: number
}


interface CachedCart {
  id: string

  groups: CartGroup[]

  subtotal: number

  cachedAt: string
}


/*
 * The IndexedDB cart record is namespaced by
 * the authenticated Supabase user ID.
 *
 * This prevents one account's cached cart from
 * being displayed to another account using the
 * same browser/device.
 */
async function getCartCacheKey(): Promise<string | null> {
  try {
    const supabase = createClient()

    const {
      data,
      error,
    } = await supabase.auth.getSession()

    if (error) {
      console.warn(
        '[Mboga Offline] Could not read local session:',
        error
      )

      return null
    }

    const userId =
      data.session?.user?.id

    if (!userId) {
      return null
    }

    return `cart:${userId}`
  } catch (error) {
    console.warn(
      '[Mboga Offline] Failed to determine cart cache key:',
      error
    )

    return null
  }
}


/*
 * Save the server cart into IndexedDB.
 */
async function cacheCart(
  data: CartResponse
): Promise<void> {
  try {
    const cacheKey =
      await getCartCacheKey()

    if (!cacheKey) {
      return
    }

    const record: CachedCart = {
      id: cacheKey,

      groups:
        Array.isArray(data.groups)
          ? data.groups
          : [],

      subtotal:
        typeof data.subtotal === 'number'
          ? data.subtotal
          : Array.isArray(data.groups)
            ? data.groups.reduce(
                (
                  total,
                  group
                ) =>
                  total +
                  Number(
                    group.subtotal || 0
                  ),
                0
              )
            : 0,

      cachedAt:
        new Date().toISOString(),
    }

    await put(
      STORES.cart,
      record
    )

    console.info(
      '[Mboga Offline] Cart cached successfully.'
    )
  } catch (error) {
    /*
     * Offline caching must never break
     * the normal online cart.
     */
    console.warn(
      '[Mboga Offline] Failed to cache cart:',
      error
    )
  }
}


/*
 * Load the last successfully synchronized
 * cart from IndexedDB.
 */
async function loadCachedCart(): Promise<
  CachedCart | null
> {
  try {
    const cacheKey =
      await getCartCacheKey()

    if (!cacheKey) {
      return null
    }

    const cached =
      await get<CachedCart>(
        STORES.cart,
        cacheKey
      )

    if (!cached) {
      return null
    }

    return cached
  } catch (error) {
    console.warn(
      '[Mboga Offline] Failed to load cached cart:',
      error
    )

    return null
  }
}


export default function CartPage() {
  const router =
    useRouter()


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
  ] = useState<string | null>(
    null
  )


  /*
   * Apply cart data to React state.
   */
  const applyCart =
    useCallback(
      (
        data: CartResponse
      ) => {
        const nextGroups =
          Array.isArray(data.groups)
            ? data.groups
            : []


        const calculatedSubtotal =
          typeof data.subtotal ===
          'number'
            ? data.subtotal
            : nextGroups.reduce(
                (
                  total,
                  group
                ) =>
                  total +
                  Number(
                    group.subtotal || 0
                  ),
                0
              )


        setGroups(
          nextGroups
        )

        setSubtotal(
          calculatedSubtotal
        )
      },
      []
    )


  /*
   * Load cart.
   *
   * Online:
   *   server → state → IndexedDB
   *
   * Offline:
   *   IndexedDB → state
   */
  const loadCart =
    useCallback(
      async (
        showLoading = true
      ) => {
        try {
          if (showLoading) {
            setLoading(true)
          }

          setError('')


          const currentlyOnline =
            typeof navigator !==
              'undefined'
              ? navigator.onLine
              : true


          /*
           * If the browser already knows it
           * is offline, do not waste time
           * attempting the API request.
           */
          if (!currentlyOnline) {
            setOffline(true)

            const cached =
              await loadCachedCart()


            if (cached) {
              applyCart({
                groups:
                  cached.groups,

                subtotal:
                  cached.subtotal,
              })

              setCachedAt(
                cached.cachedAt
              )

              return
            }


            setGroups([])

            setSubtotal(0)

            setError(
              'You are offline and there is no saved cart on this device.'
            )

            return
          }


          /*
           * Internet is available.
           */
          setOffline(false)


          const response =
            await fetch(
              '/api/cart',
              {
                method: 'GET',

                credentials:
                  'include',

                cache: 'no-store',
              }
            )


          /*
           * Authentication is still controlled
           * by the existing server API.
           */
          if (
            response.status ===
            401
          ) {
            router.push(
              '/login'
            )

            return
          }


          let data:
            CartResponse & {
              error?: string
            }


          try {
            data =
              await response.json()
          } catch {
            throw new Error(
              'Invalid response from cart server.'
            )
          }


          if (!response.ok) {
            throw new Error(
              data.error ||
                'Failed to load cart'
            )
          }


          /*
           * Apply the authoritative server
           * response first.
           */
          applyCart(data)


          /*
           * Then save the same authoritative
           * response locally.
           */
          await cacheCart(data)


          const saved =
            await loadCachedCart()


          if (saved) {
            setCachedAt(
              saved.cachedAt
            )
          }
        } catch (e: unknown) {
          /*
           * A network/API failure may still
           * have a usable cached cart.
           */
          const cached =
            await loadCachedCart()


          if (cached) {
            setOffline(true)

            applyCart({
              groups:
                cached.groups,

              subtotal:
                cached.subtotal,
            })

            setCachedAt(
              cached.cachedAt
            )

            setError(
              'Showing your last saved cart. Reconnect to refresh it.'
            )

            return
          }


          const message =
            e instanceof Error
              ? e.message
              : 'Failed to load cart'


          setError(message)
        } finally {
          setLoading(false)
        }
      },
      [
        applyCart,
        router,
      ]
    )


  /*
   * Initial cart load.
   */
  useEffect(() => {
    void loadCart()
  }, [loadCart])


  /*
   * Keep the UI aware of connection
   * changes.
   */
  useEffect(() => {
    function handleOnline() {
      setOffline(false)

      /*
       * Once the connection returns,
       * immediately synchronize the cart
       * from the server.
       */
      void loadCart(false)
    }


    function handleOffline() {
      setOffline(true)
    }


    window.addEventListener(
      'online',
      handleOnline
    )

    window.addEventListener(
      'offline',
      handleOffline
    )


    return () => {
      window.removeEventListener(
        'online',
        handleOnline
      )

      window.removeEventListener(
        'offline',
        handleOffline
      )
    }
  }, [loadCart])


  /*
   * Update quantity.
   *
   * IMPORTANT:
   *
   * We intentionally do not perform
   * an offline mutation yet.
   *
   * That comes after the mutation queue
   * is implemented and tested.
   */
  async function updateQty(
    cartItemId: string,
    quantity: number
  ) {
    if (offline) {
      setError(
        'You are offline. Reconnect before changing your cart.'
      )

      return
    }


    try {
      setError('')


      const response =
        await fetch(
          '/api/cart',
          {
            method: 'PATCH',

            headers: {
              'Content-Type':
                'application/json',
            },

            credentials:
              'include',

            /*
             * The existing API expects
             * "id", not "cartItemId".
             */
            body: JSON.stringify({
              id: cartItemId,

              quantity,
            }),
          }
        )


      if (
        response.status ===
        401
      ) {
        router.push(
          '/login'
        )

        return
      }


      if (!response.ok) {
        let message =
          'Failed to update cart'


        try {
          const data =
            await response.json()

          message =
            data.error ||
            message
        } catch {
          /*
           * Keep the default message.
           */
        }


        throw new Error(
          message
        )
      }


      await loadCart(false)
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : 'Failed to update cart'
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
        'You are offline. Reconnect before changing your cart.'
      )

      return
    }


    try {
      setError('')


      const response =
        await fetch(
          `/api/cart?id=${encodeURIComponent(
            cartItemId
          )}`,
          {
            method: 'DELETE',

            credentials:
              'include',
          }
        )


      if (
        response.status ===
        401
      ) {
        router.push(
          '/login'
        )

        return
      }


      if (!response.ok) {
        let message =
          'Failed to remove item'


        try {
          const data =
            await response.json()

          message =
            data.error ||
            message
        } catch {
          /*
           * Keep the default message.
           */
        }


        throw new Error(
          message
        )
      }


      await loadCart(false)
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : 'Failed to remove item'
      )
    }
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="h-8 w-32 bg-slate-200 animate-pulse rounded mb-6" />

        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-32 bg-slate-200 animate-pulse rounded-2xl"
            />
          ))}
        </div>
      </div>
    )
  }


  return (
    <div className="min-h-screen bg-slate-50 pb-28">

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


      <main className="p-4 space-y-4">

        {offline && (
          <div className="card p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm">

            <p className="font-semibold">
              You are offline
            </p>

            <p className="mt-1">
              Your last saved cart is being
              shown. Cart changes require an
              internet connection for now.
            </p>

            {cachedAt && (
              <p className="text-xs mt-1 opacity-80">
                Last saved:{' '}
                {new Date(
                  cachedAt
                ).toLocaleString()}
              </p>
            )}

          </div>
        )}


        {error && (
          <div className="card p-4 text-red-600 text-center">
            {error}
          </div>
        )}


        {groups.length === 0 &&
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


        {groups.map((group) => {

          const delivery =
            group.vendor.deliveryFee ||
            50

          const service = 10

          const total =
            group.subtotal +
            delivery +
            service

          const belowMin =
            group.subtotal <
            (
              group.vendor
                .minOrderAmount ||
              0
            )


          return (
            <div
              key={group.vendor.id}
              className="card overflow-hidden"
            >

              <div className="bg-primary-50 px-4 py-3 flex items-center justify-between">

                <div>

                  <p className="font-bold">
                    {group.vendor.businessName}
                  </p>

                  {!group.vendor.isOpen && (
                    <p className="text-xs text-red-600 font-medium">
                      Currently closed
                    </p>
                  )}

                  {offline && (
                    <p className="text-xs text-amber-700 font-medium mt-1">
                      Offline copy
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


              <div className="divide-y divide-slate-100">

                {group.items.map(
                  (item) => (

                    <div
                      key={item.id}
                      className="p-4 flex gap-3"
                    >

                      <div className="flex-1">

                        <p className="font-semibold">
                          {item.name}
                        </p>

                        <p className="text-xs text-slate-500">
                          {item.unit} · KES{' '}
                          {item.price}
                        </p>


                        {item.instructions && (
                          <p className="text-xs text-accent-600 mt-0.5">
                            📝{' '}
                            {item.instructions}
                          </p>
                        )}


                        <div className="flex items-center gap-3 mt-2">

                          <button
                            onClick={() =>
                              updateQty(
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
                            {item.quantity}
                          </span>


                          <button
                            onClick={() =>
                              updateQty(
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
                              removeItem(
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
                        KES {item.lineTotal}
                      </p>

                    </div>

                  )
                )}

              </div>


              <div className="px-4 py-3 bg-slate-50 space-y-1 text-sm">

                <div className="flex justify-between">
                  <span>
                    Subtotal
                  </span>

                  <span>
                    KES {group.subtotal}
                  </span>
                </div>


                <div className="flex justify-between">
                  <span>
                    Delivery
                  </span>

                  <span>
                    KES {delivery}
                  </span>
                </div>


                <div className="flex justify-between">
                  <span>
                    Service fee
                  </span>

                  <span>
                    KES {service}
                  </span>
                </div>


                <div className="flex justify-between font-bold text-base pt-1 border-t border-slate-200">

                  <span>
                    Total
                  </span>

                  <span className="text-primary-700">
                    KES {total}
                  </span>

                </div>

              </div>


              {belowMin && (
                <div className="px-4 py-2 bg-amber-50 text-amber-700 text-sm">
                  Minimum order is KES{' '}
                  {group.vendor.minOrderAmount}.
                  {' '}Add more items.
                </div>
              )}


              <div className="p-4">

                <button
                  disabled={
                    offline ||
                    belowMin ||
                    !group.vendor.isOpen
                  }
                  onClick={() =>
                    router.push(
                      `/customer/checkout?vendorId=${group.vendor.id}`
                    )
                  }
                  className="btn-primary w-full disabled:opacity-50"
                >

                  {offline
                    ? 'Reconnect for Checkout'
                    : !group.vendor.isOpen
                    ? 'Vendor Closed'
                    : belowMin
                    ? `Min KES ${group.vendor.minOrderAmount}`
                    : `Checkout · KES ${total}`}

                </button>

              </div>

            </div>
          )
        })}

      </main>


      <BottomNav role="CUSTOMER" />

    </div>
  )
}
