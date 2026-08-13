/*
 * Mboga Market
 * Offline Mutation Queue
 *
 * Supports:
 *   PATCH /api/cart
 *   DELETE /api/cart?id=...
 *   POST /api/cart
 *
 * POST cart additions use a desired final quantity.
 * Before replaying a POST, the server cart is checked.
 * This prevents duplicate additions when a request
 * succeeded but the response was lost.
 */

import {
  get,
  getAll,
  put,
  remove,
  STORES,
} from '@/lib/offline/db'


export type OfflineMutationMethod =
  | 'POST'
  | 'PATCH'
  | 'DELETE'


export type OfflineMutationStatus =
  | 'pending'
  | 'processing'
  | 'failed'
  | 'blocked'


export interface OfflineMutation {
  id?: number

  userId: string

  method: OfflineMutationMethod

  url: string

  body?: Record<string, unknown>

  createdAt: string

  updatedAt: string

  attempts: number

  status: OfflineMutationStatus

  lastError?: string

  description: string
}


interface CachedCartItem {
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
  offlinePending?: boolean
}


interface CachedCartGroup {
  vendor: {
    id: string
    businessName: string
    deliveryFee: number
    minOrderAmount: number
    isOpen: boolean
    status?: string
  }

  items: CachedCartItem[]

  subtotal: number
}


interface CachedCart {
  id: string
  groups: CachedCartGroup[]
  subtotal: number
  cachedAt: string
}


function now() {
  return new Date().toISOString()
}


async function getMutationByDescription(
  userId: string,
  description: string,
  createdAt: string
): Promise<number> {
  const mutations =
    await getAll<OfflineMutation>(
      STORES.mutations
    )


  const matches =
    mutations
      .filter(
        mutation =>
          mutation.userId === userId &&
          mutation.createdAt === createdAt &&
          mutation.description === description
      )
      .sort(
        (a, b) =>
          (b.id || 0) -
          (a.id || 0)
      )


  const mutation =
    matches[0]


  if (
    !mutation ||
    mutation.id === undefined
  ) {
    throw new Error(
      'Offline mutation was saved but its queue ID could not be determined.'
    )
  }


  return mutation.id
}


/*
 * Queue cart quantity update.
 */
export async function queueCartQuantityUpdate(
  userId: string,
  cartItemId: string,
  quantity: number
): Promise<number> {
  if (!userId) {
    throw new Error(
      'A user ID is required.'
    )
  }


  if (!cartItemId) {
    throw new Error(
      'A cart item ID is required.'
    )
  }


  if (
    !Number.isFinite(quantity) ||
    quantity < 1
  ) {
    throw new Error(
      'Cart quantity must be at least 1.'
    )
  }


  const timestamp = now()


  const mutation: OfflineMutation = {
    userId,

    method: 'PATCH',

    url: '/api/cart',

    body: {
      id: cartItemId,
      quantity,
    },

    createdAt:
      timestamp,

    updatedAt:
      timestamp,

    attempts: 0,

    status: 'pending',

    description:
      `Update cart item ${cartItemId} quantity to ${quantity}`,
  }


  await put(
    STORES.mutations,
    mutation
  )


  return getMutationByDescription(
    userId,
    mutation.description,
    timestamp
  )
}


/*
 * Queue cart removal.
 */
export async function queueCartRemoval(
  userId: string,
  cartItemId: string
): Promise<number> {
  if (!userId) {
    throw new Error(
      'A user ID is required.'
    )
  }


  if (!cartItemId) {
    throw new Error(
      'A cart item ID is required.'
    )
  }


  const timestamp = now()


  const mutation: OfflineMutation = {
    userId,

    method: 'DELETE',

    url:
      `/api/cart?id=${encodeURIComponent(
        cartItemId
      )}`,

    createdAt:
      timestamp,

    updatedAt:
      timestamp,

    attempts: 0,

    status: 'pending',

    description:
      `Remove cart item ${cartItemId}`,
  }


  await put(
    STORES.mutations,
    mutation
  )


  return getMutationByDescription(
    userId,
    mutation.description,
    timestamp
  )
}


/*
 * Queue an OFFLINE Add to Cart.
 *
 * desiredQuantity means:
 *
 * "When this reaches the server,
 * this product should have AT LEAST
 * this quantity."
 *
 * This is what makes replay safe.
 */
export async function queueCartAddition(
  userId: string,
  vendor: {
    id: string
    businessName: string
    deliveryFee: number
    minOrderAmount: number
    isOpen: boolean
    status?: string
  },
  product: {
    id: string
    name: string
    unit: string
    price: number
    image?: string
    stockStatus?: string
  },
  quantity: number,
  instructions?: string
): Promise<number> {
  if (!userId) {
    throw new Error(
      'A user ID is required.'
    )
  }


  if (!product.id) {
    throw new Error(
      'A product ID is required.'
    )
  }


  if (
    !Number.isFinite(quantity) ||
    quantity < 1
  ) {
    throw new Error(
      'Quantity must be at least 1.'
    )
  }


  const cacheKey =
    `cart:${userId}`


  const cached =
    await get<CachedCart>(
      STORES.cart,
      cacheKey
    )


  let groups =
    cached?.groups
      ? structuredClone(
          cached.groups
        )
      : []


  let group =
    groups.find(
      item =>
        item.vendor.id ===
        vendor.id
    )


  if (!group) {
    group = {
      vendor: {
        id: vendor.id,
        businessName:
          vendor.businessName,
        deliveryFee:
          vendor.deliveryFee,
        minOrderAmount:
          vendor.minOrderAmount,
        isOpen:
          vendor.isOpen,
        status:
          vendor.status,
      },

      items: [],

      subtotal: 0,
    }

    groups.push(group)
  }


  let item =
    group.items.find(
      existing =>
        existing.vendorProductId ===
        product.id
    )


  const existingQuantity =
    item?.quantity || 0


  const desiredQuantity =
    existingQuantity +
    quantity


  const lineTotal =
    Number(product.price) *
    desiredQuantity


  if (item) {
    item.quantity =
      desiredQuantity

    item.lineTotal =
      lineTotal

    item.instructions =
      instructions ||
      item.instructions

    item.offlinePending =
      true
  } else {
    item = {
      /*
       * UUID is deliberately used
       * so the cart UI can safely
       * hold the temporary item.
       */
      id:
        crypto.randomUUID(),

      vendorProductId:
        product.id,

      name:
        product.name,

      unit:
        product.unit,

      price:
        Number(product.price),

      quantity:
        desiredQuantity,

      instructions:
        instructions,

      lineTotal,

      image:
        product.image,

      stockStatus:
        product.stockStatus,

      offlinePending:
        true,
    }


    group.items.push(
      item
    )
  }


  group.subtotal =
    group.items.reduce(
      (
        total,
        cartItem
      ) =>
        total +
        Number(
          cartItem.lineTotal ||
            0
        ),
      0
    )


  const subtotal =
    groups.reduce(
      (
        total,
        cartGroup
      ) =>
        total +
        Number(
          cartGroup.subtotal ||
            0
        ),
      0
    )


  /*
   * Update the visible offline
   * cart immediately.
   */
  await put<CachedCart>(
    STORES.cart,
    {
      id: cacheKey,

      groups,

      subtotal,

      cachedAt:
        cached?.cachedAt ||
        new Date().toISOString(),
    }
  )


  const timestamp =
    now()


  const mutation: OfflineMutation = {
    userId,

    method: 'POST',

    url: '/api/cart',

    body: {
      __offlineCartAdd:
        true,

      vendorProductId:
        product.id,

      desiredQuantity,

      instructions:
        instructions ||
        undefined,
    },

    createdAt:
      timestamp,

    updatedAt:
      timestamp,

    attempts: 0,

    status: 'pending',

    description:
      `Add ${product.name} to cart with desired quantity ${desiredQuantity}`,
  }


  await put(
    STORES.mutations,
    mutation
  )


  return getMutationByDescription(
    userId,
    mutation.description,
    timestamp
  )
}


/*
 * Get all mutations for a user.
 */
export async function getUserMutations(
  userId: string
): Promise<OfflineMutation[]> {
  if (!userId) {
    return []
  }


  const mutations =
    await getAll<OfflineMutation>(
      STORES.mutations
    )


  return mutations
    .filter(
      mutation =>
        mutation.userId ===
        userId
    )
    .sort(
      (a, b) =>
        (a.id || 0) -
        (b.id || 0)
    )
}


/*
 * Pending mutations.
 */
export async function getPendingMutations(
  userId: string
): Promise<OfflineMutation[]> {
  const mutations =
    await getUserMutations(
      userId
    )


  return mutations.filter(
    mutation =>
      mutation.status ===
        'pending' ||
      mutation.status ===
        'failed'
  )
}


/*
 * Pending count.
 */
export async function getPendingMutationCount(
  userId: string
): Promise<number> {
  const mutations =
    await getPendingMutations(
      userId
    )

  return mutations.length
}


async function updateMutation(
  mutation: OfflineMutation
) {
  await put(
    STORES.mutations,
    mutation
  )
}


/*
 * Read the authoritative server
 * cart for safe POST reconciliation.
 */
async function getServerCart() {
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
      401 ||
    response.status ===
      403
  ) {
    throw new Error(
      `AUTH_REQUIRED:${response.status}`
    )
  }


  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}`
    )
  }


  return response.json()
}


/*
 * Synchronize an offline Add to Cart.
 */
async function syncCartAddition(
  mutation: OfflineMutation
) {
  const body =
    mutation.body || {}


  const vendorProductId =
    typeof body.vendorProductId ===
    'string'
      ? body.vendorProductId
      : ''


  const desiredQuantity =
    Number(
      body.desiredQuantity
    )


  if (
    !vendorProductId ||
    !Number.isFinite(
      desiredQuantity
    ) ||
    desiredQuantity < 1
  ) {
    throw new Error(
      'Invalid offline cart addition.'
    )
  }


  /*
   * IMPORTANT:
   *
   * First read the server cart.
   *
   * If a previous POST already
   * succeeded, the server quantity
   * will already be at the desired
   * quantity and we do NOT POST again.
   */
  const serverCart =
    await getServerCart()


  const serverGroups =
    Array.isArray(
      serverCart?.groups
    )
      ? serverCart.groups
      : []


  let currentQuantity =
    0


  for (
    const group of
    serverGroups
  ) {
    const found =
      Array.isArray(
        group.items
      )
        ? group.items.find(
            (
              item: any
            ) =>
              item.vendorProductId ===
              vendorProductId
          )
        : null


    if (found) {
      currentQuantity =
        Number(
          found.quantity ||
            0
        )

      break
    }
  }


  /*
   * Already satisfied.
   */
  if (
    currentQuantity >=
    desiredQuantity
  ) {
    return
  }


  const quantityToAdd =
    desiredQuantity -
    currentQuantity


  const response =
    await fetch(
      '/api/cart',
      {
        method: 'POST',

        credentials:
          'include',

        headers: {
          'Content-Type':
            'application/json',

          Accept:
            'application/json',
        },

        body:
          JSON.stringify({
            vendorProductId,

            quantity:
              quantityToAdd,

            instructions:
              body.instructions ||
              undefined,
          }),
      }
    )


  if (
    response.status ===
      401 ||
    response.status ===
      403
  ) {
    throw new Error(
      `AUTH_REQUIRED:${response.status}`
    )
  }


  if (!response.ok) {
    let message =
      `HTTP ${response.status}`


    try {
      const data =
        await response.json()


      if (
        typeof data?.error ===
        'string'
      ) {
        message =
          data.error
      }
    } catch {
      // Keep HTTP message.
    }


    throw new Error(
      message
    )
  }
}


/*
 * Send a normal PATCH/DELETE
 * mutation.
 */
async function sendStandardMutation(
  mutation: OfflineMutation
) {
  const options:
    RequestInit = {
    method:
      mutation.method,

    credentials:
      'include',

    headers: {
      Accept:
        'application/json',
    },
  }


  if (
    mutation.method ===
      'PATCH'
  ) {
    options.headers = {
      ...options.headers,

      'Content-Type':
        'application/json',
    }

    options.body =
      JSON.stringify(
        mutation.body ||
          {}
      )
  }


  const response =
    await fetch(
      mutation.url,
      options
    )


  if (
    response.status ===
      401 ||
    response.status ===
      403
  ) {
    throw new Error(
      `AUTH_REQUIRED:${response.status}`
    )
  }


  /*
   * DELETE 404 means the
   * desired final state already
   * exists.
   */
  if (
    mutation.method ===
      'DELETE' &&
    response.status ===
      404
  ) {
    return
  }


  if (!response.ok) {
    let message =
      `HTTP ${response.status}`


    try {
      const data =
        await response.json()


      if (
        typeof data?.error ===
        'string'
      ) {
        message =
          data.error
      }
    } catch {
      // Keep HTTP message.
    }


    throw new Error(
      message
    )
  }
}


/*
 * Synchronize one mutation.
 */
async function syncMutation(
  mutation: OfflineMutation
): Promise<{
  success: boolean
  blocked: boolean
}> {
  if (
    mutation.id ===
    undefined
  ) {
    return {
      success: false,
      blocked: false,
    }
  }


  mutation.status =
    'processing'

  mutation.updatedAt =
    now()


  await updateMutation(
    mutation
  )


  try {
    if (
      mutation.method ===
      'POST' &&
      mutation.body
        ?.__offlineCartAdd ===
        true
    ) {
      await syncCartAddition(
        mutation
      )
    } else {
      await sendStandardMutation(
        mutation
      )
    }


    await remove(
      STORES.mutations,
      mutation.id
    )


    return {
      success: true,
      blocked: false,
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unknown synchronization error'


    mutation.attempts += 1

    mutation.updatedAt =
      now()


    if (
      message.startsWith(
        'AUTH_REQUIRED:'
      )
    ) {
      mutation.status =
        'blocked'

      mutation.lastError =
        'Authentication is required before this operation can synchronize.'


      await updateMutation(
        mutation
      )


      return {
        success: false,
        blocked: true,
      }
    }


    mutation.status =
      'failed'

    mutation.lastError =
      message


    await updateMutation(
      mutation
    )


    return {
      success: false,
      blocked: false,
    }
  }
}


/*
 * Synchronize all mutations
 * in queue order.
 */
export async function syncPendingMutations(
  userId: string
): Promise<{
  total: number
  succeeded: number
  failed: number
  blocked: number
}> {
  if (!userId) {
    return {
      total: 0,
      succeeded: 0,
      failed: 0,
      blocked: 0,
    }
  }


  if (
    typeof navigator !==
      'undefined' &&
    !navigator.onLine
  ) {
    return {
      total: 0,
      succeeded: 0,
      failed: 0,
      blocked: 0,
    }
  }


  const mutations =
    await getPendingMutations(
      userId
    )


  let succeeded = 0
  let failed = 0
  let blocked = 0


  for (
    const mutation of
    mutations
  ) {
    const result =
      await syncMutation(
        mutation
      )


    if (
      result.success
    ) {
      succeeded += 1
      continue
    }


    if (
      result.blocked
    ) {
      blocked += 1
      break
    }


    failed += 1
  }


  return {
    total:
      mutations.length,

    succeeded,

    failed,

    blocked,
  }
}


/*
 * Unblock mutations after
 * authentication succeeds.
 */
export async function unblockUserMutations(
  userId: string
): Promise<number> {
  const mutations =
    await getUserMutations(
      userId
    )


  let count = 0


  for (
    const mutation of
    mutations
  ) {
    if (
      mutation.status !==
      'blocked'
    ) {
      continue
    }


    mutation.status =
      'pending'

    mutation.updatedAt =
      now()

    mutation.lastError =
      undefined


    await updateMutation(
      mutation
    )


    count += 1
  }


  return count
}


/*
 * Clear queued mutations.
 */
export async function clearUserMutations(
  userId: string
): Promise<number> {
  const mutations =
    await getUserMutations(
      userId
    )


  let count = 0


  for (
    const mutation of
    mutations
  ) {
    if (
      mutation.id ===
      undefined
    ) {
      continue
    }


    await remove(
      STORES.mutations,
      mutation.id
    )


    count += 1
  }


  return count
}
