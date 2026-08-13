import type { Metadata, Viewport } from 'next'

import './globals.css'

import { ToastProvider } from '@/components/ui/Toast'
import ServiceWorkerRegistration from '@/components/pwa/ServiceWorkerRegistration'

export const metadata: Metadata = {
  title: 'Mboga Market — Fresh from your neighbourhood',

  description:
    'Order fresh produce from trusted mama mbogas and greengrocers near you in Kiambu and beyond. Pay with M-Pesa. Delivered by boda.',

  keywords:
    'mboga, vegetables, Kenya, Kiambu, mama mboga, fresh produce, delivery',

  manifest: '/manifest.json',

  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Mboga Market',
  },
}

export const viewport: Viewport = {
  themeColor: '#16a34a',

  width: 'device-width',

  initialScale: 1,

  maximumScale: 1,

  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <ServiceWorkerRegistration />

        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  )
}
