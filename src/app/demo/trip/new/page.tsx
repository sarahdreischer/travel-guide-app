import Link from 'next/link'
import Image from 'next/image'
import AppFooter from '@/components/AppFooter'

export const metadata = {
  title: 'Demo · New trip – Trip Guide',
}

export default function DemoNewTripPage() {
  return (
    <>
      <header className="page-header">
        <h1 className="page-title">New trip</h1>
        <div className="page-brand">
          <Image src="/app-icon.png" alt="" width={22} height={22} className="page-brand-icon" aria-hidden="true" />
          <span className="page-brand-label">Trip Guide</span>
        </div>
        <span className="demo-badge" aria-label="Demo mode">Demo</span>
      </header>

      <div className="page-body">
        <div className="empty-state" style={{ borderTop: 'none' }}>
          <p className="empty-state-text">
            Creating trips is available in the full app. This demo shows a set of example
            trips so you can explore how personalised travel advice looks.
          </p>
          <Link href="/login" className="empty-state-btn">
            Sign in to plan a trip
          </Link>
          <div style={{ height: 12 }} />
          <Link href="/demo/destinations" className="auth-toggle-link">
            Back to demo trips
          </Link>
        </div>
        <AppFooter />
      </div>
    </>
  )
}
