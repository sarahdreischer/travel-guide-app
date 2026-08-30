import Link from 'next/link'
import Image from 'next/image'
import AppFooter from '@/components/AppFooter'

export const metadata = {
  title: 'Demo · Profile – Travel Guide',
}

function IconChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

// Static demo user — no auth, no DB.
const DEMO_USER = { firstName: 'Alex', lastName: 'Rivera' }

export default function DemoProfilePage() {
  const initials = [DEMO_USER.firstName[0], DEMO_USER.lastName[0]].filter(Boolean).join('').toUpperCase()
  const displayName = [DEMO_USER.firstName, DEMO_USER.lastName].filter(Boolean).join(' ')

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Profile</h1>
        <div className="page-brand">
          <Image src="/app-icon.png" alt="" width={22} height={22} className="page-brand-icon" aria-hidden="true" />
          <span className="page-brand-label">Travel Guide</span>
        </div>
        <span className="demo-badge" aria-label="Demo mode">Demo</span>
      </header>

      <div className="page-body">
        <div className="demo-notice">
          <span>You&apos;re exploring a read-only demo.</span>
          <Link href="/login">Sign in to save trips</Link>
        </div>

        {/* Identity block */}
        <div className="profile-identity">
          <div className="profile-avatar" aria-hidden="true">
            <span className="profile-initials">{initials}</span>
          </div>
          <div className="profile-name-block">
            <p className="profile-display-name">{displayName}</p>
            <p className="field-hint" style={{ marginTop: 2 }}>Demo account</p>
          </div>
        </div>

        {/* Account details (read-only in demo) */}
        <span className="section-label" style={{ marginTop: 8, display: 'block' }}>
          Account details
        </span>
        <div className="profile-form">
          <div className="field-block">
            <label className="field-label" htmlFor="demo-first">First name</label>
            <input id="demo-first" type="text" className="field-input" value={DEMO_USER.firstName} readOnly />
          </div>
          <div className="field-block">
            <label className="field-label" htmlFor="demo-last">Last name</label>
            <input id="demo-last" type="text" className="field-input" value={DEMO_USER.lastName} readOnly />
          </div>
        </div>

        {/* Account actions */}
        <span className="section-label" style={{ marginTop: 24, display: 'block' }}>
          Account
        </span>
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <Link href="/terms" className="profile-action-row">
            <span>Terms of Service</span>
            <IconChevronRight />
          </Link>
          <Link href="/privacy" className="profile-action-row">
            <span>Privacy Policy</span>
            <IconChevronRight />
          </Link>
          <Link href="/cookies" className="profile-action-row">
            <span>Cookie Policy</span>
            <IconChevronRight />
          </Link>
          <Link href="/login" className="profile-action-row">
            <span>Exit demo</span>
            <IconChevronRight />
          </Link>
        </div>

        <AppFooter />
      </div>
    </>
  )
}
