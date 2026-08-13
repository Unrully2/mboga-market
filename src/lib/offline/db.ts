/*
 * Mboga Market
 * Offline IndexedDB Database
 *
 * This file contains ONLY the local database layer.
 *
 * It does not:
 * - modify Supabase
 * - modify API routes
 * - modify authentication
 * - modify checkout
 * - modify the service worker
 *
 * Those layers will use this database later.
 */

const DB_NAME = 'mboga-market-offline'

const DB_VERSION = 1


/*
 * All stores used by the offline system.
 *
 * We create them now so the database schema has
 * one controlled source of truth.
 */
export const STORES = {
  cart: 'cart',

  products: 'products',

  orders: 'orders',

  deliveries: 'deliveries',

  mutations: 'mutations',

  metadata: 'metadata',
} as const


export type StoreName =
  (typeof STORES)[keyof typeof STORES]


/*
 * Database instance promise.
 *
 * Keeping a single promise prevents multiple
 * simultaneous database-open operations.
 */
let databasePromise:
  | Promise<IDBDatabase>
  | null = null


/*
 * Check whether IndexedDB is available.
 */
function isIndexedDBAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.indexedDB !== 'undefined'
  )
}


/*
 * Open the Mboga Market offline database.
 */
export function openOfflineDatabase(): Promise<IDBDatabase> {
  if (!isIndexedDBAvailable()) {
    return Promise.reject(
      new Error(
        'IndexedDB is not available in this browser.'
      )
    )
  }


  if (databasePromise) {
    return databasePromise
  }


  databasePromise =
    new Promise<IDBDatabase>(
      (resolve, reject) => {
        const request =
          window.indexedDB.open(
            DB_NAME,
            DB_VERSION
          )


        request.onupgradeneeded =
          () => {
            const db =
              request.result


            /*
             * CART
             *
             * keyPath = id
             *
             * A customer's complete locally
             * cached cart is stored as one record.
             */
            if (
              !db.objectStoreNames.contains(
                STORES.cart
              )
            ) {
              db.createObjectStore(
                STORES.cart,
                {
                  keyPath: 'id',
                }
              )
            }


            /*
             * PRODUCTS
             *
             * Individual products are stored by
             * product ID.
             *
             * This allows the customer catalog
             * to be cached locally.
             */
            if (
              !db.objectStoreNames.contains(
                STORES.products
              )
            ) {
              db.createObjectStore(
                STORES.products,
                {
                  keyPath: 'id',
                }
              )
            }


            /*
             * ORDERS
             *
             * Used for locally cached customer
             * orders and later synchronization
             * metadata.
             */
            if (
              !db.objectStoreNames.contains(
                STORES.orders
              )
            ) {
              const store =
                db.createObjectStore(
                  STORES.orders,
                  {
                    keyPath: 'id',
                  }
                )


              store.createIndex(
                'status',
                'status',
                {
                  unique: false,
                }
              )


              store.createIndex(
                'createdAt',
                'createdAt',
                {
                  unique: false,
                }
              )
            }


            /*
             * DELIVERIES
             *
             * Used by the rider offline layer.
             */
            if (
              !db.objectStoreNames.contains(
                STORES.deliveries
              )
            ) {
              const store =
                db.createObjectStore(
                  STORES.deliveries,
                  {
                    keyPath: 'id',
                  }
                )


              store.createIndex(
                'status',
                'status',
                {
                  unique: false,
                }
              )


              store.createIndex(
                'updatedAt',
                'updatedAt',
                {
                  unique: false,
                }
              )
            }


            /*
             * MUTATIONS
             *
             * This is the most important store
             * for synchronization.
             *
             * Every operation waiting to reach
             * the server gets its own numeric ID.
             */
            if (
              !db.objectStoreNames.contains(
                STORES.mutations
              )
            ) {
              const store =
                db.createObjectStore(
                  STORES.mutations,
                  {
                    keyPath: 'id',
                    autoIncrement: true,
                  }
                )


              store.createIndex(
                'status',
                'status',
                {
                  unique: false,
                }
              )


              store.createIndex(
                'userId',
                'userId',
                {
                  unique: false,
                }
              )


              store.createIndex(
                'createdAt',
                'createdAt',
                {
                  unique: false,
                }
              )
            }


            /*
             * METADATA
             *
             * Small pieces of synchronization
             * information.
             *
             * Example:
             *
             * {
             *   key: "customer:products:lastSync",
             *   value: "2026-08-13T..."
             * }
             */
            if (
              !db.objectStoreNames.contains(
                STORES.metadata
              )
            ) {
              db.createObjectStore(
                STORES.metadata,
                {
                  keyPath: 'key',
                }
              )
            }
          }


        request.onsuccess =
          () => {
            const db =
              request.result


            /*
             * If another browser tab upgrades
             * the database, close this connection
             * so a new connection can be opened.
             */
            db.onversionchange =
              () => {
                db.close()

                databasePromise =
                  null
              }


            resolve(db)
          }


        request.onerror =
          () => {
            databasePromise =
              null

            reject(
              request.error ||
                new Error(
                  'Failed to open offline database.'
                )
            )
          }


        request.onblocked =
          () => {
            console.warn(
              '[Mboga Offline DB] Database upgrade is blocked by another open connection.'
            )
          }
      }
    )


  return databasePromise
}


/*
 * Run a read/write IndexedDB transaction.
 */
function runTransaction<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  operation: (
    store: IDBObjectStore
  ) => IDBRequest<T> | void
): Promise<T | undefined> {
  return new Promise(
    async (resolve, reject) => {
      try {
        const db =
          await openOfflineDatabase()


        const transaction =
          db.transaction(
            storeName,
            mode
          )


        const store =
          transaction.objectStore(
            storeName
          )


        let request:
          | IDBRequest<T>
          | undefined


        try {
          request =
            operation(store) as
              | IDBRequest<T>
              | undefined
        } catch (error) {
          reject(error)

          return
        }


        transaction.oncomplete =
          () => {
            if (request) {
              resolve(
                request.result
              )
            } else {
              resolve(undefined)
            }
          }


        transaction.onerror =
          () => {
            reject(
              transaction.error ||
                new Error(
                  'IndexedDB transaction failed.'
                )
            )
          }


        transaction.onabort =
          () => {
            reject(
              transaction.error ||
                new Error(
                  'IndexedDB transaction aborted.'
                )
            )
          }
      } catch (error) {
        reject(error)
      }
    }
  )
}


/*
 * Put a record into a store.
 */
export async function put<T>(
  storeName: StoreName,
  value: T
): Promise<void> {
  await runTransaction(
    storeName,
    'readwrite',
    (store) => {
      store.put(value)
    }
  )
}


/*
 * Get one record by its primary key.
 */
export async function get<T>(
  storeName: StoreName,
  key: IDBValidKey
): Promise<T | undefined> {
  return (
    await runTransaction<T>(
      storeName,
      'readonly',
      (store) => {
        return store.get(key)
      }
    )
  )
}


/*
 * Delete one record.
 */
export async function remove(
  storeName: StoreName,
  key: IDBValidKey
): Promise<void> {
  await runTransaction(
    storeName,
    'readwrite',
    (store) => {
      store.delete(key)
    }
  )
}


/*
 * Return every record in a store.
 */
export async function getAll<T>(
  storeName: StoreName
): Promise<T[]> {
  const result =
    await runTransaction<T[]>(
      storeName,
      'readonly',
      (store) => {
        return store.getAll()
      }
    )


  return result || []
}


/*
 * Clear an entire store.
 *
 * This is intentionally exported because it
 * is useful for:
 *
 * - logout cleanup
 * - development reset
 * - synchronization recovery
 *
 * It must NOT be called automatically during
 * ordinary page loads.
 */
export async function clearStore(
  storeName: StoreName
): Promise<void> {
  await runTransaction(
    storeName,
    'readwrite',
    (store) => {
      store.clear()
    }
  )
}


/*
 * Count records in a store.
 */
export async function count(
  storeName: StoreName
): Promise<number> {
  const result =
    await runTransaction<number>(
      storeName,
      'readonly',
      (store) => {
        return store.count()
      }
    )


  return result || 0
}


/*
 * Delete the complete offline database.
 *
 * This should normally only be used for:
 *
 * - account logout cleanup
 * - explicit "clear offline data"
 * - development/testing
 */
export async function deleteOfflineDatabase(): Promise<void> {
  if (
    typeof window === 'undefined' ||
    !window.indexedDB
  ) {
    return
  }


  if (databasePromise) {
    try {
      const db =
        await databasePromise

      db.close()
    } catch {
      /*
       * Ignore close errors.
       */
    }

    databasePromise =
      null
  }


  await new Promise<void>(
    (resolve, reject) => {
      const request =
        window.indexedDB.deleteDatabase(
          DB_NAME
        )


      request.onsuccess =
        () => {
          resolve()
        }


      request.onerror =
        () => {
          reject(
            request.error ||
              new Error(
                'Failed to delete offline database.'
              )
          )
        }


      request.onblocked =
        () => {
          console.warn(
            '[Mboga Offline DB] Database deletion is blocked by another tab.'
          )
        }
    }
  )
}


/*
 * Simple database health check.
 *
 * We use this before integrating the database
 * with real application pages.
 */
export async function testOfflineDatabase(): Promise<{
  available: boolean
  stores: string[]
}> {
  const db =
    await openOfflineDatabase()


  return {
    available: true,

    stores:
      Array.from(
        db.objectStoreNames
      ),
  }
}
