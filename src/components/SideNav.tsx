'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

function IconGlobe() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function IconUser() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function IconSidebarToggle({ collapsed }: { collapsed: boolean }) {
  return collapsed ? (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="3" width="14" height="1.5" rx="0.75" fill="currentColor" />
      <rect x="1" y="7.25" width="9" height="1.5" rx="0.75" fill="currentColor" />
      <rect x="1" y="11.5" width="14" height="1.5" rx="0.75" fill="currentColor" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="3" width="14" height="1.5" rx="0.75" fill="currentColor" />
      <rect x="1" y="7.25" width="14" height="1.5" rx="0.75" fill="currentColor" />
      <rect x="1" y="11.5" width="14" height="1.5" rx="0.75" fill="currentColor" />
    </svg>
  )
}

const navItems = [
  { label: 'Trips', href: '/destinations', Icon: IconGlobe },
  { label: 'New trip', href: '/trip/new', Icon: IconPlus },
  { label: 'Profile', href: '/profile', Icon: IconUser },
]

/**
 * @param basePath Optional path prefix (e.g. "/demo") applied to every nav link.
 */
export default function SideNav({ basePath = '' }: { basePath?: string }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <nav className={`side-nav${collapsed ? ' side-nav-collapsed' : ''}`} aria-label="Main navigation">
      <div className="side-nav-top">
        {!collapsed && (
          <div className="side-nav-brand">
            <Image src="/app-icon.png" alt="" width={20} height={20} className="side-nav-brand-icon" aria-hidden="true" />
            Travel Guide
          </div>
        )}
        {collapsed && (
          <Image src="/app-icon.png" alt="Travel Guide" width={20} height={20} className="side-nav-brand-icon" />
        )}
        <button
          className="side-nav-toggle"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <IconSidebarToggle collapsed={collapsed} />
        </button>
      </div>
      <div className="side-nav-items">
        {navItems.map(({ label, href, Icon }) => {
          const fullHref = `${basePath}${href}`
          const isActive = pathname === fullHref || pathname.startsWith(fullHref + '/')
          return (
            <Link
              key={href}
              href={fullHref}
              className={`side-nav-item${isActive ? ' side-nav-item-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              title={collapsed ? label : undefined}
            >
              <Icon />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
