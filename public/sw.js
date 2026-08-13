const CACHE_VERSION = 'mboga-v1'

const STATIC_CACHE =
  `${CACHE_VERSION}-static`

const OFFLINE_CACHE =
  `${CACHE_VERSION}-offline`

const OFFLINE_URL =
  '/offline.html'


/*
 * Files that should always be available.
 */
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  OFFLINE_URL,
]


/*
 * INSTALL
 */
self.addEventListener(
  'install',
  (event) => {
    event.waitUntil(
      caches.open(
        STATIC_CACHE
      ).then((cache) =>
        cache.addAll(
          STATIC_ASSETS
        )
      )
    )

    /*
     * Activate the new worker immediately.
     */
    self.skipWaiting()
  }
)


/*
 * ACTIVATE
 */
self.addEventListener(
  'activate',
  (event) => {
    event.waitUntil(
      Promise.all([
        cleanupOldCaches(),
        self.clients.claim(),
      ])
    )
  }
)


async function cleanupOldCaches() {
  const keys =
    await caches.keys()

  await Promise.all(
    keys
      .filter(
        (key) =>
          key !== STATIC_CACHE &&
          key !== OFFLINE_CACHE
      )
      .map((key) =>
        caches.delete(key)
      )
  )
}


/*
 * FETCH
 */
self.addEventListener(
  'fetch',
  (event) => {
    const request =
      event.request

    const url =
      new URL(request.url)


    /*
     * Only handle GET requests.
     *
     * NEVER cache POST/PATCH/PUT/DELETE
     * mutations here.
     *
     * Those will be handled by the
     * application's offline queue.
     */
    if (
      request.method !== 'GET'
    ) {
      return
    }


    /*
     * Only handle our own origin.
     *
     * We don't want to interfere with
     * Google Maps, Supabase, external images,
     * etc.
     */
    if (
      url.origin !== self.location.origin
    ) {
      return
    }


    /*
     * API requests:
     *
     * Do NOT blindly cache authenticated
     * API responses.
     *
     * User-specific data belongs in
     * IndexedDB with explicit application
     * control.
     */
    if (
      url.pathname.startsWith('/api/')
    ) {
      return
    }


    /*
     * Next.js internal requests:
     *
     * Network first, cache successful
     * responses.
     */
    if (
      url.pathname.startsWith('/_next/')
    ) {
      event.respondWith(
        networkFirst(request)
      )

      return
    }


    /*
     * Navigation requests.
     *
     * Network first:
     *
     * ONLINE:
     *   fresh Next.js page
     *
     * OFFLINE:
     *   cached page if available
     *   otherwise offline screen
     */
    if (
      request.mode === 'navigate'
    ) {
      event.respondWith(
        navigationHandler(request)
      )

      return
    }


    /*
     * Static assets:
     *
     * Cache first.
     */
    event.respondWith(
      cacheFirst(request)
    )
  }
)


/*
 * Navigation handler.
 */
async function navigationHandler(
  request
) {
  try {
    const response =
      await fetch(request)

    /*
     * Cache successful navigations.
     *
     * This gives the app a previously visited
     * page when temporarily offline.
     */
    if (
      response.ok &&
      response.type === 'basic'
    ) {
      const cache =
        await caches.open(
          OFFLINE_CACHE
        )

      cache.put(
        request,
        response.clone()
      )
    }

    return response
  } catch {
    /*
     * Try exact cached page.
     */
    const cached =
      await caches.match(
        request
      )

    if (cached) {
      return cached
    }

    /*
     * Fall back to the offline page.
     */
    const offline =
      await caches.match(
        OFFLINE_URL
      )

    if (offline) {
      return offline
    }

    return new Response(
      `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport"
              content="width=device-width,initial-scale=1">
            <title>Mboga Market Offline</title>
          </head>
          <body>
            <h1>Mboga Market</h1>
            <p>You are offline.</p>
            <p>Please reconnect and try again.</p>
          </body>
        </html>
      `,
      {
        status: 503,
        headers: {
          'Content-Type':
            'text/html; charset=utf-8',
        },
      }
    )
  }
}


/*
 * Network first.
 */
async function networkFirst(
  request
) {
  try {
    const response =
      await fetch(request)

    if (response.ok) {
      const cache =
        await caches.open(
          OFFLINE_CACHE
        )

      cache.put(
        request,
        response.clone()
      )
    }

    return response
  } catch {
    const cached =
      await caches.match(
        request
      )

    if (cached) {
      return cached
    }

    throw new Error(
      'Network unavailable'
    )
  }
}


/*
 * Cache first.
 */
async function cacheFirst(
  request
) {
  const cached =
    await caches.match(
      request
    )

  if (cached) {
    return cached
  }

  try {
    const response =
      await fetch(request)

    if (
      response.ok &&
      response.type === 'basic'
    ) {
      const cache =
        await caches.open(
          OFFLINE_CACHE
        )

      cache.put(
        request,
        response.clone()
      )
    }

    return response
  } catch {
    return new Response(
      '',
      {
        status: 503,
      }
    )
  }
}