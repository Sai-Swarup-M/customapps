'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/', label: 'Deals', icon: '🏷️' },
  { href: '/upload', label: 'Upload', icon: '📸' },
  { href: '/chat', label: 'Ask', icon: '💬' },
  { href: '/history', label: 'History', icon: '📈' },
]

export default function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex pb-safe">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors ${
            pathname === item.href ? 'text-green-600' : 'text-gray-400'
          }`}
        >
          <span className="text-xl leading-none">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
