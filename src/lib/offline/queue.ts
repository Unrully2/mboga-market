import {
  getAll,
  put,
  remove,
  STORES,
} from './db'

export type OfflineMutationStatus =
  | 'PENDING'
  | 'SYNCING'
  | 'FAILED'

export type OfflineMutation = {
  id: string

  userId: string

  type:
    | 'ACCEPT_DELIVERY'
    | 'UPDATE_DELIVERY_STATUS'
    | 'UPDATE_RIDER_LOCATION'
    | 'CREATE_ORDER'
    | 'UPDATE_ORDER'
    | 'UPDATE_PRODUCT'

  url: string

  method:
    | 'POST'
    | 'PATCH'
    | 'PUT'
    | 'DELETE'

  body?: unknown

  createdAt: string

  attempts: number

  status: OfflineMutationStatus

  lastError?: string
}


/*
 * Generate a collision-resistant local ID.
 */
function createMutationId(): string {
  if (
    typeof crypto !== 'undefined' &&
    'randomUUID' in crypto
  ) {
    return crypto.randomUUID()
  }

  return (
    `${Date.now()}-` +
    `${Math.random()
      .toString(36)
      .slice(2)}`
  )
}


/*
 * Add a mutation to the offline queue.
 */
export async function enqueueMutation(
  mutation: Omit<
    OfflineMutation,
    'id' | 'createdAt' | 'attempts' | 'status'
  >
): Promise<OfflineMutation> {
  const item: OfflineMutation = {
    ...mutation,

    id: createMutationId(),

    createdAt:
      new Date().toISOString(),

    attempts: 0,

    status: 'PENDING',
  }

  await put(
    STORES.mutations,
    item
  )

  return item
}


/*
 * Get queued mutations.
 */
export async function getPendingMutations(
  userId?: string
): Promise<OfflineMutation[]> {
  const all =
    await getAll<OfflineMutation>(
      STORES.mutations
    )

  return all
    .filter((mutation) => {
      if (
        mutation.status !== 'PENDING' &&
        mutation.status !== 'FAILED'
      ) {
        return false
      }

      if (
        userId &&
        mutation.userId !== userId
      ) {
        return false
      }

      return true
    })
    .sort(
      (a, b) =>
        a.createdAt.localeCompare(
          b.createdAt
        )
    )
}


/*
 * Mark mutation as syncing.
 */
export async function markSyncing(
  mutation: OfflineMutation
): Promise<void> {
  await put(
    STORES.mutations,
    {
      ...mutation,
      status: 'SYNCING',
    }
  )
}


/*
 * Mark mutation as failed.
 */
export async function markFailed(
  mutation: OfflineMutation,
  error: unknown
): Promise<void> {
  await put(
    STORES.mutations,
    {
      ...mutation,

      status: 'FAILED',

      attempts:
        mutation.attempts + 1,

      lastError:
        error instanceof Error
          ? error.message
          : String(error),
    }
  )
}


/*
 * Remove a successfully synchronized mutation.
 */
export async function removeMutation(
  id: string
): Promise<void> {
  await remove(
    STORES.mutations,
    id
  )
}


/*
 * Process the queue.
 *
 * This intentionally runs through our API routes
 * instead of talking directly to Supabase.
 *
 * That preserves:
 *
 * authentication
 * authorization
 * server-side validation
 * atomic order transitions
 * rider ownership
 * M-Pesa/payment rules
 */
export async function syncMutations(
  userId?: string
): Promise<{
  synced: number
  failed: number
}> {
  if (
    typeof navigator !== 'undefined' &&
    !navigator.onLine
  ) {
    return {
      synced: 0,
      failed: 0,
    }
  }

  const mutations =
    await getPendingMutations(userId)

  let synced = 0
  let failed = 0

  for (const mutation of mutations) {
    try {
      await markSyncing(mutation)

      const response =
        await fetch(
          mutation.url,
          {
            method: mutation.method,

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              mutation.body === undefined
                ? undefined
                : JSON.stringify(
                    mutation.body
                  ),

            credentials: 'include',
          }
        )

      /*
       * 401 means the user's session is not
       * available anymore.
       *
       * Do not delete the mutation.
       */
      if (response.status === 401) {
        await markFailed(
          mutation,
          new Error(
            'Authentication required'
          )
        )

        failed++
        continue
      }

      /*
       * 409 means a server-side conflict.
       *
       * Do not blindly retry forever.
       */
      if (response.status === 409) {
        await markFailed(
          mutation,
          new Error(
            'Server conflict'
          )
        )

        failed++
        continue
      }

      if (!response.ok) {
        let message =
          `HTTP ${response.status}`

        try {
          const data =
            await response.json()

          if (data?.error) {
            message =
              String(data.error)
          }
        } catch {
          // Keep HTTP message.
        }

        throw new Error(message)
      }

      await removeMutation(
        mutation.id
      )

      synced++
    } catch (error) {
      await markFailed(
        mutation,
        error
      )

      failed++
    }
  }

  return {
    synced,
    failed,
  }
}