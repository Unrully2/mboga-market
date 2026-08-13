import {
  get,
  put,
  STORES,
} from './db'

import {
  enqueueMutation,
  syncMutations,
} from './queue'


export type RiderDelivery = {
  id: string
  deliveryId?: string
  orderId?: string
  orderNumber?: string
  status?: string

  vendor?: {
    id?: string | null
    businessName?: string
    ownerName?: string
    phone?: string
    location?: string
    estate?: string
    market?: string
    latitude?: number | null
    longitude?: number | null
    rating?: number
  }

  customer?: {
    id?: string | null
    name?: string
    phone?: string
    email?: string
    profileImage?: string | null
  }

  address?: any

  items?: any[]

  itemCount?: number

  subtotal?: number
  deliveryFee?: number
  serviceFee?: number
  discount?: number
  total?: number

  deliveryNotes?: string | null
  preferredTime?: string | null
  paymentMethod?: string | null

  earnings?: number
  estimatedEarnings?: number

  createdAt?: string | null
  updatedAt?: string | null
  pickedUpAt?: string | null
  deliveredAt?: string | null
}


const AVAILABLE_KEY =
  'rider:deliveries:available'

const ACTIVE_KEY =
  'rider:deliveries:active'


type DeliveryCache = {
  key: string
  deliveries: RiderDelivery[]
  savedAt: string
}


/*
 * Save available deliveries locally.
 */
export async function cacheAvailableDeliveries(
  deliveries: RiderDelivery[]
) {
  await put<DeliveryCache>(
    STORES.metadata,
    {
      key: AVAILABLE_KEY,
      deliveries,
      savedAt:
        new Date().toISOString(),
    }
  )
}


/*
 * Save active deliveries locally.
 */
export async function cacheActiveDeliveries(
  deliveries: RiderDelivery[]
) {
  await put<DeliveryCache>(
    STORES.metadata,
    {
      key: ACTIVE_KEY,
      deliveries,
      savedAt:
        new Date().toISOString(),
    }
  )
}


/*
 * Read cached available deliveries.
 */
export async function getCachedAvailableDeliveries(): Promise<
  RiderDelivery[]
> {
  const cached =
    await get<DeliveryCache>(
      STORES.metadata,
      AVAILABLE_KEY
    )

  return cached?.deliveries || []
}


/*
 * Read cached active deliveries.
 */
export async function getCachedActiveDeliveries(): Promise<
  RiderDelivery[]
> {
  const cached =
    await get<DeliveryCache>(
      STORES.metadata,
      ACTIVE_KEY
    )

  return cached?.deliveries || []
}


/*
 * Cache both lists at once.
 */
export async function cacheRiderDeliveries(
  available: RiderDelivery[],
  active: RiderDelivery[]
) {
  await Promise.all([
    cacheAvailableDeliveries(
      available
    ),

    cacheActiveDeliveries(
      active
    ),
  ])
}


/*
 * Update an active delivery locally.
 */
export async function updateCachedDeliveryStatus(
  deliveryId: string,
  status: string
) {
  const active =
    await getCachedActiveDeliveries()

  const updated =
    active.map((delivery) => {
      if (
        delivery.id !== deliveryId
      ) {
        return delivery
      }

      return {
        ...delivery,
        status,
        updatedAt:
          new Date().toISOString(),
      }
    })

  await cacheActiveDeliveries(
    updated
  )

  return updated
}


/*
 * Remove a delivery from available cache.
 */
export async function removeFromAvailableCache(
  deliveryId: string
) {
  const available =
    await getCachedAvailableDeliveries()

  const updated =
    available.filter(
      (delivery) =>
        delivery.id !== deliveryId
    )

  await cacheAvailableDeliveries(
    updated
  )

  return updated
}


/*
 * Add an accepted delivery to active cache.
 */
export async function addToActiveCache(
  delivery: RiderDelivery
) {
  const active =
    await getCachedActiveDeliveries()

  const exists =
    active.some(
      (item) =>
        item.id === delivery.id
    )

  if (exists) {
    return active
  }

  const updated = [
    {
      ...delivery,
      status:
        delivery.status || 'ASSIGNED',
    },
    ...active,
  ]

  await cacheActiveDeliveries(
    updated
  )

  return updated
}


/*
 * Convert rider action into the local
 * optimistic status.
 */
export function actionToLocalStatus(
  action: string
): string | null {
  switch (action) {
    case 'PICKED_UP':
      return 'PICKED_UP'

    case 'START_DELIVERY':
      return 'IN_TRANSIT'

    case 'DELIVERED':
      return 'DELIVERED'

    default:
      return null
  }
}


/*
 * Verify the rider is making a valid
 * local state transition.
 *
 * This mirrors the server state machine.
 */
export function canTransitionLocally(
  currentStatus: string,
  action: string
): boolean {
  switch (currentStatus) {
    case 'ASSIGNED':
      return action === 'PICKED_UP'

    case 'PICKED_UP':
      return action === 'START_DELIVERY'

    case 'IN_TRANSIT':
      return action === 'DELIVERED'

    default:
      return false
  }
}


/*
 * Queue a rider delivery action.
 *
 * IMPORTANT:
 *
 * We do NOT modify Supabase directly.
 *
 * The exact same API endpoint used while
 * online will be replayed when connectivity
 * returns.
 */
export async function queueDeliveryAction(
  deliveryId: string,
  action: string
) {
  const status =
    actionToLocalStatus(action)

  if (!status) {
    throw new Error(
      `Unsupported rider action: ${action}`
    )
  }

  await enqueueMutation({
    userId:
      'current-rider',

    type:
      'UPDATE_DELIVERY_STATUS',

    url:
      `/api/deliveries/${deliveryId}`,

    method:
      'PATCH',

    body: {
      action,
    },
  })

  return status
}


/*
 * Synchronize queued rider actions.
 */
export async function syncRiderOfflineActions() {
  return syncMutations()
}