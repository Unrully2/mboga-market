/*
 * Mboga Market
 * Offline Mutation Queue
 *
 * This module stores customer cart mutations locally
 * until they can safely be sent to the existing API.
 *
 * Currently supported:
 *
 *   PATCH /api/cart
 *   DELETE /api/cart?id=...
 *
 * Deliberately NOT supported yet:
 *
 *   POST /api/cart
 *
 * The existing POST endpoint is not idempotent.
 * Retrying an interrupted POST could add the same
 * quantity twice.
 */

import {
  getAll,
  put,
  remove,
  STORES,
} from '@/lib/offline/db'


export type OfflineMutationMethod =
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

  /*
   * Used to identify the exact operation
   * when debugging synchronization.
   */
  description: string
}


/*
 * Queue a PATCH cart mutation.
 *
 * Example:
 *
 * queueCartQuantityUpdate(
 *   userId,
 *   cartItemId,
 *   3
 * )
 */
export async function queueCartQuantityUpdate(
  userId: string,
  cartItemId: string,
  quantity: number
): Promise<number> {
  if (!userId) {
    throw new Error(
      'A user ID is required to queue a cart update.'
    )
  }


  if (!cartItemId) {
    throw new Error(
      'A cart item ID is required to queue a cart update.'
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


  const now =
    new Date().toISOString()


  const mutation: OfflineMutation = {
    userId,

    method: 'PATCH',

    url: '/api/cart',

    body: {
      id: cartItemId,

      quantity,
    },

    createdAt: now,

    updatedAt: now,

    attempts: 0,

    status: 'pending',

    description:
      `Update cart item ${cartItemId} quantity to ${quantity}`,
  }


  await put(
    STORES.mutations,
    mutation
  )


  /*
   * IndexedDB autoIncrement assigns the
   * numeric ID, but put() deliberately does
   * not return it.
   *
   * Find the newly-created mutation by its
   * unique timestamp + description combination.
   */
  const mutations =
    await getAll<OfflineMutation>(
      STORES.mutations
    )


  const matches =
    mutations
      .filter(
        (item) =>
          item.userId ===
            userId &&
          item.createdAt ===
            now &&
          item.description ===
            mutation.description
      )
      .sort(
        (a, b) =>
          (b.id || 0) -
          (a.id || 0)
      )


  const created =
    matches[0]


  if (
    !created ||
    created.id === undefined
  ) {
    throw new Error(
      'Cart update was stored but its queue ID could not be determined.'
    )
  }


  return created.id
}


/*
 * Queue removal of a cart item.
 */
export async function queueCartRemoval(
  userId: string,
  cartItemId: string
): Promise<number> {
  if (!userId) {
    throw new Error(
      'A user ID is required to queue a cart removal.'
    )
  }


  if (!cartItemId) {
    throw new Error(
      'A cart item ID is required to queue a cart removal.'
    )
  }


  const now =
    new Date().toISOString()


  const mutation: OfflineMutation = {
    userId,

    method: 'DELETE',

    url:
      `/api/cart?id=${encodeURIComponent(
        cartItemId
      )}`,

    createdAt: now,

    updatedAt: now,

    attempts: 0,

    status: 'pending',

    description:
      `Remove cart item ${cartItemId}`,
  }


  await put(
    STORES.mutations,
    mutation
  )


  const mutations =
    await getAll<OfflineMutation>(
      STORES.mutations
    )


  const matches =
    mutations
      .filter(
        (item) =>
          item.userId ===
            userId &&
          item.createdAt ===
            now &&
          item.description ===
            mutation.description
      )
      .sort(
        (a, b) =>
          (b.id || 0) -
          (a.id || 0)
      )


  const created =
    matches[0]


  if (
    !created ||
    created.id === undefined
  ) {
    throw new Error(
      'Cart removal was stored but its queue ID could not be determined.'
    )
  }


  return created.id
}


/*
 * Return all queued mutations for one user.
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
      (mutation) =>
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
 * Return mutations that are currently
 * eligible for synchronization.
 */
export async function getPendingMutations(
  userId: string
): Promise<OfflineMutation[]> {
  const mutations =
    await getUserMutations(
      userId
    )


  return mutations.filter(
    (mutation) =>
      mutation.status ===
        'pending' ||
      mutation.status ===
        'failed'
  )
}


/*
 * Number of queued operations waiting
 * for synchronization.
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


/*
 * Update one mutation in IndexedDB.
 */
async function updateMutation(
  mutation: OfflineMutation
): Promise<void> {
  await put(
    STORES.mutations,
    mutation
  )
}


/*
 * Send one queued mutation to the
 * existing Mboga Market API.
 */
async function sendMutation(
  mutation: OfflineMutation
): Promise<void> {
  const options: RequestInit = {
    method: mutation.method,

    credentials: 'include',

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
        mutation.body || {}
      )
  }


  const response =
    await fetch(
      mutation.url,
      options
    )


  /*
   * Authentication failure is special.
   *
   * We don't delete the mutation and we
   * don't keep blindly retrying it.
   */
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
   * 404 for a DELETE is treated as success.
   *
   * The desired final state is already:
   * "item does not exist".
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
    let serverMessage =
      `HTTP ${response.status}`


    try {
      const data =
        await response.json()


      if (
        data &&
        typeof data.error ===
          'string'
      ) {
        serverMessage =
          data.error
      }
    } catch {
      /*
       * Response may not contain JSON.
       */
    }


    throw new Error(
      serverMessage
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
    new Date().toISOString()


  await updateMutation(
    mutation
  )


  try {
    await sendMutation(
      mutation
    )


    /*
     * The server accepted the
     * operation.
     *
     * Remove it permanently from
     * the queue.
     */
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
      new Date().toISOString()


    /*
     * Authentication errors must not
     * be retried repeatedly in the
     * background.
     */
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


    /*
     * Other failures remain in the
     * queue for another attempt.
     */
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
 * Synchronize all pending mutations
 * for one authenticated user.
 *
 * Operations are processed in the exact
 * order they were queued.
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


  /*
   * Do not attempt network operations
   * while the browser is offline.
   */
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


  /*
   * Sequential processing is intentional.
   *
   * Example:
   *
   * quantity 2
   * quantity 3
   *
   * We must not send these in parallel
   * and allow the server to process them
   * out of order.
   */
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

      /*
       * Stop here. Authentication
       * needs user interaction.
       */
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
 * Reset a blocked mutation back to
 * pending after the customer has
 * successfully authenticated again.
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
      new Date().toISOString()

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
 * Remove completed/old failed data
 * belonging to a user.
 *
 * We currently don't call this
 * automatically.
 */
export async function clearUserMutations(
  userId: string
): Promise<number> {
  const mutations =
    await getUserMutations(
      userId
    )


  let removedCount = 0


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


    removedCount += 1
  }


  return removedCount
}
