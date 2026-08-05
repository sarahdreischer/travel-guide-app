'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  {
    label: 'Destinations',
    href: '/destinations',
    icon: '🌍',
  },
  {
    label: 'New Trip',
    href: '/trip/new',
    icon: '✈️',
  },
  {
    label: 'Profile',
    href: '/profile',
    icon: '👤',
  },
]

export default function AppNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white"
      aria-label="Main navigation"
    >
      <ul className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/')

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center px-3 py-2 text-xs transition-colors ${
                  isActive
                    ? 'text-blue-600 font-semibold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="text-lg" aria-hidden="true">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
