import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Grocery Deals',
  description: 'Find the best grocery deals across all stores',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Grocery Deals' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#16a34a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`} style={{ colorScheme: 'light' }}>
      <body className="min-h-full bg-gray-50 font-sans" style={{ colorScheme: 'light' }}>
        {children}
        <BottomNav />
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
