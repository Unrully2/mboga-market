'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator)
    ) {
      return
    }

    /*
     * Service workers require a secure context.
     *
     * localhost is also allowed by browsers during
     * development, but we intentionally avoid
     * registering there so the development server
     * does not become polluted by stale caches.
     */
    const hostname = window.location.hostname

    const isLocalDevelopment =
      hostname === 'localhost' ||
      hostname === '127.0.0.1'

    if (isLocalDevelopment) {
      return
    }

    let cancelled = false

    async function register() {
      try {
        const registration =
          await navigator.serviceWorker.register(
            '/sw.js',
            {
              scope: '/',
            }
          )

        if (cancelled) {
          return
        }

        console.info(
          '[Mboga PWA] Service worker registered:',
          registration.scope
        )

        /*
         * Ask the browser to check whether a newer
         * service worker exists.
         */
        await registration.update()
      } catch (error) {
        console.error(
          '[Mboga PWA] Service worker registration failed:',
          error
        )
      }
    }

    register()

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
