'use client'

import { useRef, useState, useEffect } from 'react'

/**
 * Shared footer component that appears on all pages.
 * Fades in once the user has scrolled more than 60px in the nearest scroll container.
 * If the content is short enough that the user can't scroll 60px, the footer
 * becomes visible immediately (the user can already see the bottom).
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
      const { overflowY } = window.getComputedStyle(container)
      if (overflowY === 'auto' || overflowY === 'scroll') break
      container = container.parentElement
    }

    // If no overflow container found, fall back to documentElement
    if (!container || container === document.documentElement) {
      container = document.documentElement
    }

    const scrollContainer = container as HTMLElement

    function check() {
      // If user has scrolled past 60px, reveal
      if (scrollContainer.scrollTop > 60) {
        setVisible(true)
        return
      }
      // If the container can't scroll 60px total (content is short), reveal immediately
      const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight
      if (maxScroll <= 60) {
        setVisible(true)
      }
    }

    // Check after two animation frames to ensure initial paint is complete
    // (prevents flicker when visibility transitions from hidden to visible)
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        check()
      })
    })

    scrollContainer.addEventListener('scroll', check, { passive: true })
    // Re-check on resize (content may reflow)
    window.addEventListener('resize', check, { passive: true })

    return () => {
      cancelAnimationFrame(raf)
      scrollContainer.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
    }
  }, [])

  return (
    <footer ref={ref} className={`app-footer${visible ? ' app-footer-visible' : ''}`}>
      <div className="app-footer-inner">
        <div className="app-footer-cols">
          <div className="app-footer-col app-footer-col-brand">
            <p className="app-footer-brand">Travel Guide</p>
            <p className="app-footer-tagline">Personalised advice for every journey.</p>
          </div>
          {/* <div className="app-footer-col">
            <p className="app-footer-col-heading">Company</p>
            <a className="app-footer-link" href="#">About us</a>
            <a className="app-footer-link" href="#">Careers</a>
            <a className="app-footer-link" href="#">Press</a>
          </div> */}
          <div className="app-footer-col">
            <p className="app-footer-col-heading">Legal</p>
            <a className="app-footer-link" href="/privacy">Privacy Policy</a>
            <a className="app-footer-link" href="/terms">Terms of Service</a>
            <a className="app-footer-link" href="/cookies">Cookie Policy</a>
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
