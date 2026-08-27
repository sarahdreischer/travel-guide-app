'use client'

import { useState, useEffect } from 'react'

/**
 * Cookie consent banner.
 * - Compact state: cookie emoji, one-line description, "Manage" outline button + "Accept all" filled button.
 * - Expanded state: reveals Required cookies (locked on) and Analytical cookies (toggleable) rows.
 * - Persists consent to localStorage under 'cookie-consent'.
 */

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      className={`cookie-toggle${on ? ' cookie-toggle-on' : ''}${disabled ? ' cookie-toggle-disabled' : ''}`}
      onClick={() => !disabled && onChange(!on)}
      aria-label={on ? 'Enabled' : 'Disabled'}
    >
      <span className="cookie-toggle-thumb" />
    </button>
  )
}

export default function CookieBanner() {
  const [show, setShow] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [analytics, setAnalytics] = useState(true)

  useEffect(() => {
    try {
      const consent = localStorage.getItem('cookie-consent')
      if (!consent) setShow(true)
    } catch {
      setShow(true)
    }
  }, [])

  if (!show) return null

  function acceptAll() {
    try {
      localStorage.setItem('cookie-consent', JSON.stringify({ required: true, analytics: true }))
    } catch { /* noop */ }
    setShow(false)
  }

  function savePreferences() {
    try {
      localStorage.setItem('cookie-consent', JSON.stringify({ required: true, analytics }))
    } catch { /* noop */ }
    setShow(false)
  }

  return (
    <div className="cookie-overlay" role="dialog" aria-modal="true" aria-label="Cookie preferences">
      <div className="cookie-panel">
        <div className="cookie-header">
          <div className="cookie-header-left">
            <span className="cookie-icon" aria-hidden="true">🍪</span>
            <div>
              <p className="cookie-title">We use cookies</p>
              <p className="cookie-desc">
                We use cookies to keep the site working and to understand how it&apos;s used.
                {!expanded && (
                  <button className="cookie-manage-link" onClick={() => setExpanded(true)}>
                    Manage preferences
                  </button>
                )}
              </p>
            </div>
          </div>
          {!expanded && (
            <div className="cookie-actions-inline">
              <button className="cookie-btn-secondary" onClick={() => setExpanded(true)}>Manage</button>
              <button className="cookie-btn-primary" onClick={acceptAll}>Accept all</button>
            </div>
          )}
        </div>

        {expanded && (
          <>
            <div className="cookie-divider" />

            <div className="cookie-category">
              <div className="cookie-category-header">
                <div>
                  <p className="cookie-category-name">Required cookies</p>
                  <p className="cookie-category-desc">
                    Essential for the site to function — login sessions, security, and preferences. Cannot be disabled.
                  </p>
                </div>
                <Toggle on={true} onChange={() => {}} disabled />
              </div>
            </div>

            <div className="cookie-divider" />

            <div className="cookie-category">
              <div className="cookie-category-header">
                <div>
                  <p className="cookie-category-name">Analytical cookies</p>
                  <p className="cookie-category-desc">
                    Help us understand how visitors use the app so we can improve it. No personal data is sold.
                  </p>
                </div>
                <Toggle on={analytics} onChange={setAnalytics} />
              </div>
            </div>

            <div className="cookie-divider" />

            <div className="cookie-footer-actions">
              <button className="cookie-btn-secondary" onClick={savePreferences}>Save preferences</button>
              <button className="cookie-btn-primary" onClick={acceptAll}>Accept all</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
