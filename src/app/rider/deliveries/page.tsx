'use client'

import {
  useState,
  useEffect,
  useCallback,
} from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { BottomNav } from '@/components/layout/BottomNav'

import {
  getCachedAvailableDeliveries,
  getCachedActiveDeliveries,
  cacheRiderDeliveries,
  removeFromAvailableCache,
  addToActiveCache,
  updateCachedDeliveryStatus,
  canTransitionLocally,
  queueDeliveryAction,
  syncRiderOfflineActions,
  type RiderDelivery,
} from '@/lib/offline/rider'


export default function RiderDeliveriesPage() {
  const router = useRouter()

  const [
    tab,
    setTab,
  ] = useState<
    'available' | 'active'
  >('available')

  const [
    available,
    setAvailable,
  ] = useState<RiderDelivery[]>([])

  const [
    active,
    setActive,
  ] = useState<RiderDelivery[]>([])

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    actionId,
    setActionId,
  ] = useState<string | null>(null)

  const [
    online,
    setOnline,
  ] = useState(true)

  const [
    syncing,
    setSyncing,
  ] = useState(false)

  const [
    offlineMessage,
    setOfflineMessage,
  ] = useState(false)


  /*
   * Load cached rider data.
   */
  const loadCached = useCallback(
    async () => {
      try {
        const [
          cachedAvailable,
          cachedActive,
        ] = await Promise.all([
          getCachedAvailableDeliveries(),
          getCachedActiveDeliveries(),
        ])

        setAvailable(
          cachedAvailable
        )

        setActive(
          cachedActive
        )

        if (
          cachedActive.length > 0 ||
          cachedAvailable.length > 0
        ) {
          setLoading(false)
        }
      } catch (error) {
        console.error(
          '[rider offline cache]',
          error
        )
      }
    },
    []
  )


  /*
   * Load fresh server data.
   */
  const load = useCallback(
    async () => {
      /*
       * NEVER attempt the API while
       * the browser is offline.
       */
      if (!navigator.onLine) {
        await loadCached()

        setLoading(false)

        return
      }

      try {
        const [
          availableResponse,
          activeResponse,
        ] = await Promise.all([
          fetch(
            '/api/deliveries?type=available',
            {
              credentials: 'include',
              cache: 'no-store',
            }
          ),

          fetch(
            '/api/deliveries?type=active',
            {
              credentials: 'include',
              cache: 'no-store',
            }
          ),
        ])


        /*
         * Authentication check.
         */
        if (
          availableResponse.status === 401 ||
          activeResponse.status === 401
        ) {
          router.push('/login')

          return
        }


        /*
         * Parse responses.
         */
        const availableData =
          await availableResponse.json()

        const activeData =
          await activeResponse.json()


        /*
         * Server errors.
         */
        if (
          !availableResponse.ok ||
          !activeResponse.ok
        ) {
          throw new Error(
            availableData?.error ||
            activeData?.error ||
            'Failed to load deliveries'
          )
        }


        const nextAvailable =
          Array.isArray(
            availableData?.deliveries
          )
            ? availableData.deliveries
            : []

        const nextActive =
          Array.isArray(
            activeData?.deliveries
          )
            ? activeData.deliveries
            : []


        /*
         * Update UI.
         */
        setAvailable(
          nextAvailable
        )

        setActive(
          nextActive
        )


        /*
         * Persist fresh server state
         * locally.
         */
        await cacheRiderDeliveries(
          nextAvailable,
          nextActive
        )
      } catch (error) {
        console.warn(
          '[rider deliveries] network load failed',
          error
        )

        /*
         * If the network failed despite
         * navigator.onLine saying true,
         * use the cached state.
         */
        await loadCached()
      } finally {
        setLoading(false)
      }
    },
    [
      router,
      loadCached,
    ]
  )


  /*
   * Synchronize offline actions.
   */
  const syncOffline = useCallback(
    async () => {
      if (!navigator.onLine) {
        return
      }

      setSyncing(true)

      try {
        const result =
          await syncRiderOfflineActions()

        if (
          result.synced > 0
        ) {
          /*
           * Reload authoritative server
           * state after synchronization.
           */
          await load()
        }
      } catch (error) {
        console.error(
          '[rider offline sync]',
          error
        )
      } finally {
        setSyncing(false)
      }
    },
    [load]
  )


  /*
   * Initial load.
   */
  useEffect(() => {
    setOnline(
      navigator.onLine
    )

    loadCached()

    load()
  }, [
    load,
    loadCached,
  ])


  /*
   * Automatic refresh while online.
   */
  useEffect(() => {
    const interval =
      setInterval(() => {
        if (
          navigator.onLine
        ) {
          load()
        }
      }, 10000)

    return () =>
      clearInterval(interval)
  }, [load])


  /*
   * Network state listeners.
   */
  useEffect(() => {
    const handleOnline =
      async () => {
        setOnline(true)

        setOfflineMessage(false)

        /*
         * First synchronize queued actions.
         */
        await syncOffline()

        /*
         * Then refresh authoritative
         * server state.
         */
        await load()
      }


    const handleOffline =
      async () => {
        setOnline(false)

        setOfflineMessage(true)

        await loadCached()
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
  }, [
    load,
    loadCached,
    syncOffline,
  ])


  /*
   * GPS tracking.
   *
   * Location is NOT sent while offline.
   *
   * We will build a dedicated location
   * queue later because location data
   * should be compressed/debounced rather
   * than storing every GPS point forever.
   */
  useEffect(() => {
    if (!navigator.geolocation) {
      return
    }


    const ping = () => {
      if (!navigator.onLine) {
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetch(
            '/api/rider/location',
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              credentials:
                'include',

              body:
                JSON.stringify({
                  latitude:
                    position.coords
                      .latitude,

                  longitude:
                    position.coords
                      .longitude,
                }),
            }
          ).catch(() => {})
        },

        () => {},

        {
          enableHighAccuracy:
            true,

          maximumAge:
            30000,
        }
      )
    }


    ping()

    const interval =
      setInterval(
        ping,
        30000
      )


    return () =>
      clearInterval(interval)
  }, [])


  /*
   * Accept a new delivery.
   *
   * We deliberately DO NOT allow this
   * offline.
   *
   * Why?
   *
   * Available deliveries can be claimed
   * by another rider while this rider is
   * offline.
   *
   * Accepting from stale data could result
   * in a misleading local assignment.
   */
  async function accept(
    orderId: string
  ) {
    if (!navigator.onLine) {
      alert(
        'You are offline. Connect to the internet before accepting a new delivery.'
      )

      return
    }


    setActionId(orderId)


    try {
      const response =
        await fetch(
          '/api/deliveries',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            credentials:
              'include',

            body:
              JSON.stringify({
                orderId,
              }),
          }
        )


      const data =
        await response.json()


      if (
        !response.ok
      ) {
        alert(
          data?.error ||
          'Failed to accept delivery'
        )

        return
      }


      setTab('active')

      await load()
    } catch {
      alert(
        'Network error. Connect to the internet and try again.'
      )
    } finally {
      setActionId(null)
    }
  }


  /*
   * Rider delivery action.
   *
   * ONLINE:
   *
   *    send directly to API
   *
   * OFFLINE:
   *
   *    update IndexedDB
   *    queue API request
   *
   */
  async function doAction(
    deliveryId: string,
    action: string
  ) {
    const delivery =
      active.find(
        (item) =>
          item.id === deliveryId
      )


    if (!delivery) {
      alert(
        'Delivery is not available locally.'
      )

      return
    }


    /*
     * Prevent invalid local transitions.
     */
    if (
      !canTransitionLocally(
        delivery.status || '',
        action
      )
    ) {
      alert(
        `Cannot perform ${action} while delivery is ${delivery.status}.`
      )

      return
    }


    setActionId(
      deliveryId
    )


    try {
      /*
       * ==================================
       * OFFLINE
       * ==================================
       */
      if (!navigator.onLine) {
        const nextStatus =
          await queueDeliveryAction(
            deliveryId,
            action
          )


        /*
         * Optimistically update UI.
         */
        const updated =
          active.map(
            (item) => {
              if (
                item.id !==
                deliveryId
              ) {
                return item
              }

              return {
                ...item,

                status:
                  nextStatus,

                updatedAt:
                  new Date()
                    .toISOString(),

                /*
                 * Keep useful local
                 * timestamps.
                 */
                ...(nextStatus ===
                  'PICKED_UP'
                  ? {
                      pickedUpAt:
                        new Date()
                          .toISOString(),
                    }
                  : {}),

                ...(nextStatus ===
                  'DELIVERED'
                  ? {
                      deliveredAt:
                        new Date()
                          .toISOString(),
                    }
                  : {}),
              }
            }
          )


        setActive(
          updated
        )


        /*
         * Persist optimistic state.
         */
        await cacheRiderDeliveries(
          available,
          updated
        )


        setOfflineMessage(
          true
        )

        return
      }


      /*
       * ==================================
       * ONLINE
       * ==================================
       */
      const response =
        await fetch(
          `/api/deliveries/${deliveryId}`,
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
                action,
              }),
          }
        )


      const data =
        await response.json()


      if (
        !response.ok
      ) {
        alert(
          data?.error ||
          'Failed to update delivery'
        )

        return
      }


      /*
       * Server is authoritative.
       */
      await load()
    } catch (error) {
      /*
       * Network may have disappeared
       * between navigator.onLine and fetch().
       *
       * In that situation we can safely
       * queue the action.
       */
      if (!navigator.onLine) {
        try {
          const nextStatus =
            await queueDeliveryAction(
              deliveryId,
              action
            )


          const updated =
            active.map(
              (item) => {
                if (
                  item.id !==
                  deliveryId
                ) {
                  return item
                }

                return {
                  ...item,

                  status:
                    nextStatus,

                  updatedAt:
                    new Date()
                      .toISOString(),
                }
              }
            )


          setActive(
            updated
          )


          await cacheRiderDeliveries(
            available,
            updated
          )


          setOnline(false)

          setOfflineMessage(
            true
          )
        } catch (
          queueError
        ) {
          console.error(
            '[rider queue]',
            queueError
          )

          alert(
            'Could not save the action offline.'
          )
        }
      } else {
        console.error(
          '[rider action]',
          error
        )

        alert(
          'Network error. Please try again.'
        )
      }
    } finally {
      setActionId(null)
    }
  }


  return (
    <div className="min-h-screen bg-slate-100 pb-24">


      {/* HEADER */}
      <header className="bg-slate-800 text-white p-4 flex items-center gap-3">

        <Link
          href="/rider"
          className="text-2xl"
        >
          ←
        </Link>

        <h1 className="text-xl font-bold">
          Deliveries
        </h1>

        <div className="ml-auto flex items-center gap-2">

          {syncing && (
            <span className="text-xs">
              SYNCING…
            </span>
          )}

          <span
            className={`w-3 h-3 rounded-full ${
              online
                ? 'bg-green-400'
                : 'bg-red-400'
            }`}
          />

        </div>

      </header>


      {/* OFFLINE BAR */}
      {!online && (
        <div className="bg-red-600 text-white px-4 py-3 text-center text-sm font-bold">

          OFFLINE MODE — delivery actions
          are being saved on this device.

        </div>
      )}


      {online &&
        offlineMessage && (
          <div className="bg-green-600 text-white px-4 py-3 text-center text-sm font-bold">

            BACK ONLINE — synchronizing
            delivery changes…

          </div>
        )}


      {/* TABS */}
      <div className="p-4 flex gap-2">

        <button
          onClick={() =>
            setTab('available')
          }
          className={`flex-1 py-2 rounded-xl text-sm font-bold ${
            tab === 'available'
              ? 'bg-accent-500 text-white'
              : 'bg-white text-slate-600'
          }`}
        >
          Available ({available.length})
        </button>


        <button
          onClick={() =>
            setTab('active')
          }
          className={`flex-1 py-2 rounded-xl text-sm font-bold ${
            tab === 'active'
              ? 'bg-primary-600 text-white'
              : 'bg-white text-slate-600'
          }`}
        >
          Active ({active.length})
        </button>

      </div>


      <main className="px-4 space-y-4">


        {loading && (
          <div className="h-32 bg-white animate-pulse rounded-2xl" />
        )}


        {/* AVAILABLE EMPTY */}
        {tab === 'available' &&
          !loading &&
          available.length === 0 && (

            <div className="card p-10 text-center text-slate-500">

              <p className="text-4xl mb-2">
                🛵
              </p>

              <p className="font-medium">
                No available deliveries
              </p>

              <p className="text-sm mt-1">
                Orders appear when vendors
                mark them ready
              </p>

            </div>
          )}


        {/* AVAILABLE */}
        {tab === 'available' &&
          available.map(
            (d) => (

              <div
                key={d.orderId || d.id}
                className="card p-4 border-2 border-accent-300"
              >

                <div className="flex justify-between mb-2">

                  <p className="font-bold text-lg">
                    {d.orderNumber}
                  </p>

                  <span className="text-sm font-bold text-green-600">
                    ~KES {d.estimatedEarnings}
                  </span>

                </div>


                <div className="text-sm space-y-1 mb-4">

                  <p>
                    <span className="text-slate-500">
                      Pickup:
                    </span>{' '}

                    <strong>
                      {d.vendor?.businessName}
                    </strong>
                  </p>


                  <p className="text-slate-500">
                    {d.vendor?.location}
                  </p>


                  <p>
                    <span className="text-slate-500">
                      Customer:
                    </span>{' '}

                    {d.customer?.name}
                  </p>


                  <p className="text-slate-500">
                    {d.itemCount} items ·
                    Order KES {d.total}
                  </p>

                </div>


                <div className="flex gap-3">

                  <button
                    onClick={() =>
                      accept(
                        d.orderId ||
                        d.id
                      )
                    }

                    disabled={
                      actionId ===
                      (
                        d.orderId ||
                        d.id
                      ) ||
                      !online
                    }

                    className={`flex-1 text-white font-bold py-3 rounded-xl text-lg ${
                      online
                        ? 'bg-primary-600'
                        : 'bg-slate-400'
                    }`}
                  >

                    {actionId ===
                      (
                        d.orderId ||
                        d.id
                      )
                      ? '…'
                      : online
                        ? 'ACCEPT'
                        : 'CONNECT TO ACCEPT'}

                  </button>

                </div>

              </div>
            )
          )}


        {/* ACTIVE EMPTY */}
        {tab === 'active' &&
          !loading &&
          active.length === 0 && (

            <div className="card p-10 text-center text-slate-500">

              <p className="font-medium">
                No active deliveries
              </p>

              <p className="text-sm mt-1">
                Accept a job from Available
              </p>

            </div>
          )}


        {/* ACTIVE */}
        {tab === 'active' &&
          active.map(
            (d) => (

              <div
                key={d.id}
                className="card p-4"
              >

                <div className="flex justify-between mb-2">

                  <p className="font-bold text-lg">
                    {d.orderNumber}
                  </p>

                  <span className="text-xs font-semibold bg-primary-100 text-primary-700 px-2 py-1 rounded">
                    {d.status}
                  </span>

                </div>


                <div className="text-sm space-y-1 mb-4 bg-slate-50 rounded-xl p-3">

                  <p>
                    <strong>
                      Pickup:
                    </strong>{' '}

                    {d.vendor?.businessName}
                  </p>


                  <p className="text-slate-500">
                    {d.vendor?.location}
                  </p>


                  <p>
                    <strong>
                      Customer:
                    </strong>{' '}

                    {d.customer?.name}
                    {' · '}
                    {d.customer?.phone}
                  </p>


                  {d.deliveryNotes && (
                    <p className="text-accent-600">
                      📝 {d.deliveryNotes}
                    </p>
                  )}


                  <p className="font-semibold text-green-600">
                    Earn KES {d.earnings}
                  </p>

                </div>


                {/* ACTION BUTTONS */}

                <div className="space-y-2">


                  {/* ASSIGNED */}

                  {d.status ===
                    'ASSIGNED' && (

                    <>

                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${d.vendor?.latitude || ''},${d.vendor?.longitude || ''}`}

                        target="_blank"

                        rel="noopener noreferrer"

                        className="block w-full text-center bg-slate-200 font-bold py-3 rounded-xl"
                      >
                        📍 NAVIGATE TO PICKUP
                      </a>


                      <button
                        onClick={() =>
                          doAction(
                            d.id,
                            'PICKED_UP'
                          )
                        }

                        disabled={
                          actionId ===
                          d.id
                        }

                        className="w-full bg-primary-600 text-white font-bold py-4 rounded-xl text-lg"
                      >

                        {actionId ===
                          d.id
                          ? '…'
                          : 'PICKED UP'}

                      </button>

                    </>
                  )}


                  {/* PICKED UP */}

                  {d.status ===
                    'PICKED_UP' && (

                    <button
                      onClick={() =>
                        doAction(
                          d.id,
                          'START_DELIVERY'
                        )
                      }

                      disabled={
                        actionId ===
                        d.id
                      }

                      className="w-full bg-sky-600 text-white font-bold py-4 rounded-xl text-lg"
                    >

                      {actionId ===
                        d.id
                        ? '…'
                        : 'START DELIVERY'}

                    </button>
                  )}


                  {/* IN TRANSIT */}

                  {d.status ===
                    'IN_TRANSIT' && (

                    <button
                      onClick={() =>
                        doAction(
                          d.id,
                          'DELIVERED'
                        )
                      }

                      disabled={
                        actionId ===
                        d.id
                      }

                      className="w-full bg-green-600 text-white font-bold py-4 rounded-xl text-lg"
                    >

                      {actionId ===
                        d.id
                        ? '…'
                        : 'DELIVERED'}

                    </button>
                  )}

                </div>

              </div>
            )
          )}

      </main>


      <BottomNav
        role="RIDER"
      />

    </div>
  )
}
