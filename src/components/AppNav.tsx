'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

function IconGlobe() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function IconUser() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

const navItems = [
  { label: 'Destinations', href: '/destinations', Icon: IconGlobe },
  { label: 'New trip',     href: '/trip/new',     Icon: IconPlus  },
  { label: 'Profile',      href: '/profile',      Icon: IconUser  },
]

/**
 * @param basePath Optional path prefix (e.g. "/demo") applied to every nav link.
 */
export default function AppNav({ basePath = '' }: { basePath?: string }) {
  const pathname = usePathname()

  return (
    <nav className="app-nav" aria-label="Main navigation">
      {/* inner row constrained to the same max-width as the content */}
      <div className="app-nav-inner">
        {navItems.map(({ label, href, Icon }) => {
          const fullHref = `${basePath}${href}`
          const isActive = pathname === fullHref || pathname.startsWith(fullHref + '/')
          return (
            <Link
              key={href}
              href={fullHref}
              className={`app-nav-item${isActive ? ' app-nav-item-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
