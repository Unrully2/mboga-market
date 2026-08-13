'use client'

import { useEffect } from 'react'

export default function
ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      !('serviceWorker' in navigator)
    ) {
      return
    }

    /*
     * Do not register on localhost during
     * development unless explicitly wanted.
     *
     * This prevents development caching
     * from becoming a nightmare.
     */
    if (
      window.location.hostname ===
        'localhost' ||
      window.location.hostname ===
        '127.0.0.1'
    ) {
      return
    }

    let mounted = true

    const register = async () => {
      try {
        const registration =
          await navigator.serviceWorker.register(
            '/sw.js',
            {
              scope: '/',
            }
          )

        if (!mounted) {
          return
        }

        console.log(
          '[PWA] Service worker registered:',
          registration.scope
        )

        /*
         * Check for updates whenever the
         * application starts.
         */
        registration.update()
      } catch (error) {
        console.error(
          '[PWA] Service worker registration failed:',
          error
        )
      }
    }

    register()

    return () => {
      mounted = false
    }
  }, [])

  return null
}