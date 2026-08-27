'use client'

import { useRef, useState, useEffect } from 'react'

/**
 * Shared footer component that appears on all pages.
 * Fades in once the user has scrolled more than 60px in the nearest scroll container.
 * Walks up the DOM to find the scroll container (.page-body, .category-detail-body,
 * .auth-page, or .main-panel).
 */
export default function AppFooter() {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Walk up the DOM to find the nearest scrollable ancestor
    let container: Element | null = el.parentElement
    while (container && container !== document.documentElement) {
      const cls = container.className || ''
      if (
        cls.includes('page-body') ||
        cls.includes('category-detail-body') ||
        cls.includes('auth-page') ||
        cls.includes('main-panel')
      ) {
        break
      }
      const { overflowY } = window.getComputedStyle(container)
      if (overflowY === 'auto' || overflowY === 'scroll') break
      container = container.parentElement
    }

    if (!container || container === document.documentElement) {
      // Fallback: show immediately if no scroll container found
      setVisible(true)
      return
    }

    function onScroll() {
      if ((container as HTMLElement).scrollTop > 60) {
        setVisible(true)
      }
    }

    // Check initial scroll position
    onScroll()

    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container!.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <footer ref={ref} className={`app-footer${visible ? ' app-footer-visible' : ''}`}>
      <div className="app-footer-inner">
        <div className="app-footer-cols">
          <div className="app-footer-col app-footer-col-brand">
            <p className="app-footer-brand">Travel Guide</p>
            <p className="app-footer-tagline">Personalised advice for every journey.</p>
          </div>
          <div className="app-footer-col">
            <p className="app-footer-col-heading">Company</p>
            <a className="app-footer-link" href="#">About us</a>
            <a className="app-footer-link" href="#">Careers</a>
            <a className="app-footer-link" href="#">Press</a>
          </div>
          <div className="app-footer-col">
            <p className="app-footer-col-heading">Legal</p>
            <a className="app-footer-link" href="#">Privacy Policy</a>
            <a className="app-footer-link" href="/terms">Terms &amp; Conditions</a>
            <a className="app-footer-link" href="#">Cookie Policy</a>
          </div>
          <div className="app-footer-col">
            <p className="app-footer-col-heading">Contact us</p>
            <a className="app-footer-link" href="mailto:hello@travelguide.app">hello@travelguide.app</a>
            <a className="app-footer-link" href="#">Support centre</a>
            <a className="app-footer-link" href="#">Report an issue</a>
          </div>
        </div>
        <div className="app-footer-bottom">
          <p className="app-footer-copy">&copy; 2026 Travel Guide Ltd. All rights reserved.</p>
          <p className="app-footer-copy">Registered in England &amp; Wales &middot; Company No. 14872931</p>
        </div>
      </div>
    </footer>
  )
}
