const DB_NAME = 'mboga-market-offline'
const DB_VERSION = 1

export const STORES = {
  deliveries: 'deliveries',
  orders: 'orders',
  products: 'products',
  vendors: 'vendors',
  cart: 'cart',
  mutations: 'mutations',
  metadata: 'metadata',
} as const

type StoreName =
  (typeof STORES)[keyof typeof STORES]

let dbPromise: Promise<IDBDatabase> | null = null

function openDatabase(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(
      new Error('IndexedDB is only available in the browser')
    )
  }

  if (dbPromise) {
    return dbPromise
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(
      DB_NAME,
      DB_VERSION
    )

    request.onupgradeneeded = () => {
      const db = request.result

      /*
       * Delivery snapshots
       */
      if (!db.objectStoreNames.contains(STORES.deliveries)) {
        const store = db.createObjectStore(
          STORES.deliveries,
          { keyPath: 'id' }
        )

        store.createIndex(
          'status',
          'status',
          { unique: false }
        )

        store.createIndex(
          'orderId',
          'orderId',
          { unique: false }
        )

        store.createIndex(
          'updatedAt',
          'updatedAt',
          { unique: false }
        )
      }

      /*
       * Order snapshots
       */
      if (!db.objectStoreNames.contains(STORES.orders)) {
        const store = db.createObjectStore(
          STORES.orders,
          { keyPath: 'id' }
        )

        store.createIndex(
          'status',
          'status',
          { unique: false }
        )

        store.createIndex(
          'updatedAt',
          'updatedAt',
          { unique: false }
        )
      }

      /*
       * Product snapshots
       */
      if (!db.objectStoreNames.contains(STORES.products)) {
        const store = db.createObjectStore(
          STORES.products,
          { keyPath: 'id' }
        )

        store.createIndex(
          'vendorId',
          'vendorId',
          { unique: false }
        )

        store.createIndex(
          'updatedAt',
          'updatedAt',
          { unique: false }
        )
      }

      /*
       * Vendor snapshots
       */
      if (!db.objectStoreNames.contains(STORES.vendors)) {
        const store = db.createObjectStore(
          STORES.vendors,
          { keyPath: 'id' }
        )

        store.createIndex(
          'updatedAt',
          'updatedAt',
          { unique: false }
        )
      }

      /*
       * Customer cart.
       *
       * One local cart per user.
       */
      if (!db.objectStoreNames.contains(STORES.cart)) {
        db.createObjectStore(
          STORES.cart,
          { keyPath: 'id' }
        )
      }

      /*
       * Offline mutation queue.
       *
       * Every offline action gets its own ID.
       */
      if (!db.objectStoreNames.contains(STORES.mutations)) {
        const store = db.createObjectStore(
          STORES.mutations,
          {
            keyPath: 'id',
            autoIncrement: false,
          }
        )

        store.createIndex(
          'status',
          'status',
          { unique: false }
        )

        store.createIndex(
          'createdAt',
          'createdAt',
          { unique: false }
        )

        store.createIndex(
          'userId',
          'userId',
          { unique: false }
        )
      }

      /*
       * Metadata.
       */
      if (!db.objectStoreNames.contains(STORES.metadata)) {
        db.createObjectStore(
          STORES.metadata,
          { keyPath: 'key' }
        )
      }
    }

    request.onsuccess = () => {
      const db = request.result

      db.onversionchange = () => {
        db.close()
      }

      resolve(db)
    }

    request.onerror = () => {
      dbPromise = null
      reject(request.error)
    }

    request.onblocked = () => {
      console.warn(
        '[offline] IndexedDB upgrade blocked'
      )
    }
  })

  return dbPromise
}


/*
 * Save one object.
 */
export async function put<T>(
  storeName: StoreName,
  value: T
): Promise<void> {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      storeName,
      'readwrite'
    )

    transaction.objectStore(
      storeName
    ).put(value)

    transaction.oncomplete = () => {
      resolve()
    }

    transaction.onerror = () => {
      reject(transaction.error)
    }

    transaction.onabort = () => {
      reject(
        transaction.error ||
        new Error(
          `Transaction aborted: ${storeName}`
        )
      )
    }
  })
}


/*
 * Save many objects in one transaction.
 */
export async function putMany<T>(
  storeName: StoreName,
  values: T[]
): Promise<void> {
  if (!values.length) {
    return
  }

  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      storeName,
      'readwrite'
    )

    const store =
      transaction.objectStore(storeName)

    for (const value of values) {
      store.put(value)
    }

    transaction.oncomplete = () => {
      resolve()
    }

    transaction.onerror = () => {
      reject(transaction.error)
    }

    transaction.onabort = () => {
      reject(
        transaction.error ||
        new Error(
          `Transaction aborted: ${storeName}`
        )
      )
    }
  })
}


/*
 * Get one object.
 */
export async function get<T>(
  storeName: StoreName,
  key: IDBValidKey
): Promise<T | undefined> {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      storeName,
      'readonly'
    )

    const request =
      transaction.objectStore(
        storeName
      ).get(key)

    request.onsuccess = () => {
      resolve(
        request.result as T | undefined
      )
    }

    request.onerror = () => {
      reject(request.error)
    }
  })
}


/*
 * Get everything from a store.
 */
export async function getAll<T>(
  storeName: StoreName
): Promise<T[]> {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      storeName,
      'readonly'
    )

    const request =
      transaction.objectStore(
        storeName
      ).getAll()

    request.onsuccess = () => {
      resolve(
        (request.result || []) as T[]
      )
    }

    request.onerror = () => {
      reject(request.error)
    }
  })
}


/*
 * Delete one object.
 */
export async function remove(
  storeName: StoreName,
  key: IDBValidKey
): Promise<void> {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      storeName,
      'readwrite'
    )

    transaction.objectStore(
      storeName
    ).delete(key)

    transaction.oncomplete = () => {
      resolve()
    }

    transaction.onerror = () => {
      reject(transaction.error)
    }
  })
}


/*
 * Clear a store.
 */
export async function clear(
  storeName: StoreName
): Promise<void> {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      storeName,
      'readwrite'
    )

    transaction.objectStore(
      storeName
    ).clear()

    transaction.oncomplete = () => {
      resolve()
    }

    transaction.onerror = () => {
      reject(transaction.error)
    }
  })
}


/*
 * Search by index.
 */
export async function getByIndex<T>(
  storeName: StoreName,
  indexName: string,
  value: IDBValidKey
): Promise<T[]> {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      storeName,
      'readonly'
    )

    const store =
      transaction.objectStore(storeName)

    const index =
      store.index(indexName)

    const request =
      index.getAll(value)

    request.onsuccess = () => {
      resolve(
        (request.result || []) as T[]
      )
    }

    request.onerror = () => {
      reject(request.error)
    }
  })
}