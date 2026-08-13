'use client'

import {
  useEffect,
  useState,
} from 'react'


export default function
NetworkStatus() {
  const [
    online,
    setOnline,
  ] = useState(true)

  const [
    visible,
    setVisible,
  ] = useState(false)


  useEffect(() => {
    setOnline(
      navigator.onLine
    )

    const handleOnline = () => {
      setOnline(true)
      setVisible(false)

      /*
       * Tell the rest of the application
       * that connectivity returned.
       */
      window.dispatchEvent(
        new CustomEvent(
          'mboga:online'
        )
      )
    }


    const handleOffline = () => {
      setOnline(false)
      setVisible(true)

      window.dispatchEvent(
        new CustomEvent(
          'mboga:offline'
        )
      )
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
  }, [])


  if (online && !visible) {
    return null
  }


  return (
    <div
      className={`fixed left-3 right-3 bottom-20 z-[9999] rounded-2xl px-4 py-3 shadow-lg ${
        online
          ? 'bg-green-600 text-white'
          : 'bg-slate-900 text-white'
      }`}
    >
      <div className="flex items-center justify-between gap-3">

        <div>
          <p className="font-bold text-sm">
            {online
              ? 'Back online'
              : 'You are offline'}
          </p>

          <p className="text-xs opacity-90">
            {online
              ? 'Mboga Market can synchronize your changes.'
              : 'Cached information remains available. Changes will be queued.'}
          </p>
        </div>

        {!online && (
          <span className="text-xl">
            📡
          </span>
        )}

      </div>
    </div>
  )
}