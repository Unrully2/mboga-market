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

import {
  queueCartQuantityUpdate,
  queueCartRemoval,
  syncPendingMutations,
  unblockUserMutations,
} from '@/lib/offline/mutations'

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
 * Get the currently authenticated
 * Supabase user.
 */
async function getCurrentUserId(): Promise<
  string | null
> {
  try {
    const supabase =
      createClient()

    const {
      data,
      error,
    } =
      await supabase.auth.getUser()

    if (error) {
      return null
    }

    return (
      data.user?.id ||
      null
    )
  } catch {
    return null
  }
}


/*
 * Every user's offline cart gets
 * its own IndexedDB record.
 */
async function getCartCacheKey(): Promise<
  string | null
> {
  const userId =
    await getCurrentUserId()

  if (!userId) {
    return null
  }

  return `cart:${userId}`
}


/*
 * Save a complete cart locally.
 */
async function saveCachedCart(
  groups: CartGroup[],
  subtotal: number
): Promise<void> {
  try {
    const key =
      await getCartCacheKey()

    if (!key) {
      return
    }

    const record: CachedCart = {
      id: key,

      groups,

      subtotal,

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
    console.warn(
      '[Mboga Offline] Could not cache cart:',
      error
    )
  }
}


/*
 * Read the last saved cart.
 */
async function getCachedCart(): Promise<
  CachedCart | null
> {
  try {
    const key =
      await getCartCacheKey()

    if (!key) {
      return null
    }

    const cached =
      await get<CachedCart>(
        STORES.cart,
        key
      )

    return (
      cached || null
    )
  } catch (error) {
    console.warn(
      '[Mboga Offline] Could not read cached cart:',
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
    syncing,
    setSyncing,
  ] = useState(false)


  const [
    cachedAt,
    setCachedAt,
  ] = useState<string | null>(
    null
  )


  /*
   * Apply cart to React state.
   */
  const applyCart =
    useCallback(
      (
        nextGroups: CartGroup[],
        nextSubtotal?: number
      ) => {
        setGroups(
          nextGroups
        )

        const calculated =
          typeof nextSubtotal ===
          'number'
            ? nextSubtotal
            : nextGroups.reduce(
                (
                  total,
                  group
                ) =>
                  total +
                  Number(
                    group.subtotal ||
                      0
                  ),
                0
              )

        setSubtotal(
          calculated
        )
      },
      []
    )


  /*
   * Load the authoritative server
   * cart when online.
   *
   * Falls back to IndexedDB when
   * the network is unavailable.
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


          const isOnline =
            typeof navigator ===
              'undefined'
              ? true
              : navigator.onLine


          /*
           * OFFLINE
           */
          if (!isOnline) {
            setOffline(true)

            const cached =
              await getCachedCart()

            if (cached) {
              applyCart(
                cached.groups,
                cached.subtotal
              )

              setCachedAt(
                cached.cachedAt
              )

              return
            }

            setGroups([])

            setSubtotal(0)

            setError(
              'You are offline and no saved cart is available.'
            )

            return
          }


          /*
           * ONLINE
           */
          setOffline(false)


          /*
           * First synchronize anything
           * that was queued while offline.
           */
          const userId =
            await getCurrentUserId()


          if (userId) {
            try {
              await unblockUserMutations(
                userId
              )

              setSyncing(true)

              await syncPendingMutations(
                userId
              )
            } catch (syncError) {
              console.warn(
                '[Mboga Offline] Cart synchronization failed:',
                syncError
              )
            } finally {
              setSyncing(false)
            }
          }


          /*
           * Now fetch the authoritative
           * server cart.
           */
          const response =
            await fetch(
              '/api/cart',
              {
                method: 'GET',

                credentials:
                  'include',

                cache:
                  'no-store',
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


          let data:
            CartResponse & {
              error?: string
            }


          try {
            data =
              await response.json()
          } catch {
            throw new Error(
              'Invalid cart response from server.'
            )
          }


          if (!response.ok) {
            throw new Error(
              data.error ||
                'Failed to load cart.'
            )
          }


          const nextGroups =
            Array.isArray(
              data.groups
            )
              ? data.groups
              : []


          const nextSubtotal =
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
                      group.subtotal ||
                        0
                    ),
                  0
                )


          /*
           * Server is authoritative.
           */
          applyCart(
            nextGroups,
            nextSubtotal
          )


          /*
           * Save the latest server
           * version locally.
           */
          await saveCachedCart(
            nextGroups,
            nextSubtotal
          )


          setCachedAt(
            new Date().toISOString()
          )
        } catch (e: unknown) {
          /*
           * Network failure:
           * use the last good cart.
           */
          const cached =
            await getCachedCart()


          if (cached) {
            setOffline(true)

            applyCart(
              cached.groups,
              cached.subtotal
            )

            setCachedAt(
              cached.cachedAt
            )

            setError(
              'Connection lost. Showing your last saved cart.'
            )

            return
          }


          setError(
            e instanceof Error
              ? e.message
              : 'Failed to load cart.'
          )
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
   * Initial load.
   */
  useEffect(() => {
    void loadCart()
  }, [loadCart])


  /*
   * Detect connection changes.
   */
  useEffect(() => {
    function handleOffline() {
      setOffline(true)

      setError(
        'You are offline. Cart changes will be saved locally.'
      )
    }


    function handleOnline() {
      setOffline(false)

      setError('')

      /*
       * Internet is back.
       *
       * Synchronize queued mutations
       * then reload authoritative cart.
       */
      void loadCart(false)
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
   * Update the local cart immediately.
   *
   * This is used for offline operation.
   */
  const updateLocalQuantity =
    useCallback(
      (
        cartItemId: string,
        quantity: number
      ) => {
        setGroups(
          currentGroups => {
            const nextGroups =
              currentGroups.map(
                group => {
                  const items =
                    group.items.map(
                      item => {
                        if (
                          item.id !==
                          cartItemId
                        ) {
                          return item
                        }

                        const lineTotal =
                          Number(
                            item.price
                          ) *
                          quantity

                        return {
                          ...item,

                          quantity,

                          lineTotal,
                        }
                      }
                    )


                  const groupSubtotal =
                    items.reduce(
                      (
                        total,
                        item
                      ) =>
                        total +
                        Number(
                          item.lineTotal ||
                            0
                        ),
                      0
                    )


                  return {
                    ...group,

                    items,

                    subtotal:
                      groupSubtotal,
                  }
                }
              )


            const newSubtotal =
              nextGroups.reduce(
                (
                  total,
                  group
                ) =>
                  total +
                  Number(
                    group.subtotal ||
                      0
                  ),
                0
              )


            setSubtotal(
              newSubtotal
            )


            void saveCachedCart(
              nextGroups,
              newSubtotal
            )


            return nextGroups
          }
        )
      },
      []
    )


  /*
   * Remove an item immediately
   * from the local cart.
   */
  const removeLocalItem =
    useCallback(
      (
        cartItemId: string
      ) => {
        setGroups(
          currentGroups => {
            const nextGroups =
              currentGroups
                .map(
                  group => {
                    const items =
                      group.items.filter(
                        item =>
                          item.id !==
                          cartItemId
                      )


                    const groupSubtotal =
                      items.reduce(
                        (
                          total,
                          item
                        ) =>
                          total +
                          Number(
                            item.lineTotal ||
                              0
                          ),
                        0
                      )


                    return {
                      ...group,

                      items,

                      subtotal:
                        groupSubtotal,
                    }
                  }
                )
                .filter(
                  group =>
                    group.items
                      .length >
                    0
                )


            const newSubtotal =
              nextGroups.reduce(
                (
                  total,
                  group
                ) =>
                  total +
                  Number(
                    group.subtotal ||
                      0
                  ),
                0
              )


            setSubtotal(
              newSubtotal
            )


            void saveCachedCart(
              nextGroups,
              newSubtotal
            )


            return nextGroups
          }
        )
      },
      []
    )


  /*
   * Update quantity.
   *
   * ONLINE:
   *   API → refresh server cart
   *
   * OFFLINE:
   *   local cart → queue
   */
  async function updateQty(
    cartItemId: string,
    quantity: number
  ) {
    if (
      quantity <
      1
    ) {
      return
    }


    setError('')


    const userId =
      await getCurrentUserId()


    if (!userId) {
      router.push(
        '/login'
      )

      return
    }


    const isOnline =
      navigator.onLine


    /*
     * OFFLINE
     */
    if (!isOnline) {
      try {
        await queueCartQuantityUpdate(
          userId,
          cartItemId,
          quantity
        )


        updateLocalQuantity(
          cartItemId,
          quantity
        )


        setOffline(true)

        setError(
          'Saved offline. This change will synchronize when you reconnect.'
        )
      } catch (e: unknown) {
        setError(
          e instanceof Error
            ? e.message
            : 'Could not save cart change offline.'
        )
      }

      return
    }


    /*
     * ONLINE
     */
    try {
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

            body:
              JSON.stringify({
                /*
                 * IMPORTANT:
                 *
                 * API expects "id".
                 */
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
          'Failed to update cart.'


        try {
          const data =
            await response.json()

          message =
            data.error ||
            message
        } catch {
          /*
           * Keep default.
           */
        }


        throw new Error(
          message
        )
      }


      /*
       * Server accepted the change.
       */
      await loadCart(false)
    } catch (e: unknown) {
      /*
       * The request may have failed
       * because the connection disappeared
       * during the request.
       *
       * A quantity PATCH is an absolute
       * desired quantity, so retrying the
       * same PATCH is safe.
       */
      if (
        !navigator.onLine
      ) {
        try {
          await queueCartQuantityUpdate(
            userId,
            cartItemId,
            quantity
          )


          updateLocalQuantity(
            cartItemId,
            quantity
          )


          setOffline(true)

          setError(
            'Connection lost. Your cart change was saved and will synchronize later.'
          )

          return
        } catch {
          /*
           * Fall through to normal error.
           */
        }
      }


      setError(
        e instanceof Error
          ? e.message
          : 'Failed to update cart.'
      )
    }
  }


  /*
   * Remove cart item.
   *
   * DELETE is safe to retry because
   * the desired final state is:
   * "item does not exist".
   */
  async function removeItem(
    cartItemId: string
  ) {
    setError('')


    const userId =
      await getCurrentUserId()


    if (!userId) {
      router.push(
        '/login'
      )

      return
    }


    const isOnline =
      navigator.onLine


    /*
     * OFFLINE
     */
    if (!isOnline) {
      try {
        await queueCartRemoval(
          userId,
          cartItemId
        )


        removeLocalItem(
          cartItemId
        )


        setOffline(true)

        setError(
          'Removal saved offline. It will synchronize when you reconnect.'
        )
      } catch (e: unknown) {
        setError(
          e instanceof Error
            ? e.message
            : 'Could not save removal offline.'
        )
      }

      return
    }


    /*
     * ONLINE
     */
    try {
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
          'Failed to remove item.'


        try {
          const data =
            await response.json()

          message =
            data.error ||
            message
        } catch {
          /*
           * Keep default.
           */
        }


        throw new Error(
          message
        )
      }


      await loadCart(false)
    } catch (e: unknown) {
      /*
       * If the connection disappeared,
       * queue the DELETE.
       */
      if (
        !navigator.onLine
      ) {
        try {
          await queueCartRemoval(
            userId,
            cartItemId
          )


          removeLocalItem(
            cartItemId
          )


          setOffline(true)

          setError(
            'Connection lost. The removal was saved and will synchronize later.'
          )

          return
        } catch {
          /*
           * Fall through.
           */
        }
      }


      setError(
        e instanceof Error
          ? e.message
          : 'Failed to remove item.'
      )
    }
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">

        <div className="h-8 w-32 bg-slate-200 animate-pulse rounded mb-6" />

        <div className="space-y-4">

          {[1, 2].map(
            i => (
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

        {syncing && (
          <span className="ml-auto text-xs text-primary-600 font-medium">
            Syncing...
          </span>
        )}

      </header>


      <main className="p-4 space-y-4">

        {offline && (
          <div className="card p-3 bg-amber-50 border border-amber-200 text-amber-800">

            <p className="font-semibold text-sm">
              You are offline
            </p>

            <p className="text-xs mt-1">
              Cart changes are being saved
              on this device and will
              synchronize automatically
              when internet returns.
            </p>

            {cachedAt && (
              <p className="text-[11px] mt-2 opacity-75">
                Last server sync:{' '}
                {new Date(
                  cachedAt
                ).toLocaleString()}
              </p>
            )}

          </div>
        )}


        {error && (
          <div className="card p-3 text-sm text-center text-slate-700">
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
                Browse nearby mama
                mbogas and add fresh
                produce
              </p>

              <Link
                href="/customer"
                className="btn-primary inline-block"
              >
                Shop Fresh Produce
              </Link>

            </div>
          )}


        {groups.map(
          group => {

            const delivery =
              group.vendor
                .deliveryFee ||
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
                key={
                  group.vendor.id
                }
                className="card overflow-hidden"
              >

                <div className="bg-primary-50 px-4 py-3 flex items-center justify-between">

                  <div>

                    <p className="font-bold">
                      {
                        group
                          .vendor
                          .businessName
                      }
                    </p>

                    {!group.vendor
                      .isOpen && (
                      <p className="text-xs text-red-600 font-medium">
                        Currently
                        closed
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
                    item => (

                      <div
                        key={item.id}
                        className="p-4 flex gap-3"
                      >

                        <div className="flex-1">

                          <p className="font-semibold">
                            {item.name}
                          </p>


                          <p className="text-xs text-slate-500">
                            {item.unit}
                            {' · '}
                            KES{' '}
                            {item.price}
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
                                updateQty(
                                  item.id,
                                  item.quantity -
                                    1
                                )
                              }
                              disabled={
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
                                updateQty(
                                  item.id,
                                  item.quantity +
                                    1
                                )
                              }
                              className="w-8 h-8 rounded-full border border-slate-200 font-bold"
                            >
                              +
                            </button>


                            <button
                              onClick={() =>
                                removeItem(
                                  item.id
                                )
                              }
                              className="text-xs text-red-500 ml-2"
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
                      {delivery}
                    </span>

                  </div>


                  <div className="flex justify-between">

                    <span>
                      Service fee
                    </span>

                    <span>
                      KES{' '}
                      {service}
                    </span>

                  </div>


                  <div className="flex justify-between font-bold text-base pt-1 border-t border-slate-200">

                    <span>
                      Total
                    </span>

                    <span className="text-primary-700">
                      KES{' '}
                      {total}
                    </span>

                  </div>

                </div>


                {belowMin && (
                  <div className="px-4 py-2 bg-amber-50 text-amber-700 text-sm">
                    Minimum order is
                    KES{' '}
                    {
                      group
                        .vendor
                        .minOrderAmount
                    }.
                    {' '}
                    Add more items.
                  </div>
                )}


                <div className="p-4">

                  <button
                    disabled={
                      offline ||
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

                    {offline
                      ? 'Reconnect for Checkout'
                      : !group
                          .vendor
                          .isOpen
                      ? 'Vendor Closed'
                      : belowMin
                      ? `Min KES ${group.vendor.minOrderAmount}`
                      : `Checkout · KES ${total}`}

                  </button>

                </div>

              </div>
            )
          }
        )}

      </main>


      <BottomNav
        role="CUSTOMER"
      />

    </div>
  )
}
