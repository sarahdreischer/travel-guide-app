'use client'

import Image from 'next/image'
import AppFooter from '@/components/AppFooter'

function IconArrowLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  )
}

const SECTIONS = [
  'What Are Cookies',
  'How We Use Cookies',
  'Essential Cookies',
  'Analytical Cookies',
  'Cookie Duration',
  'Third-Party Cookies',
  'Managing Cookies',
  'Impact of Disabling Cookies',
  'Updates to This Policy',
  'Contact Us',
]

const PARAGRAPHS = [
  'Cookies are small text files stored on your device when you visit a website. They help the site remember your preferences and understand how you interact with it. Cookies can be "session" cookies (deleted when you close your browser) or "persistent" cookies (remain until they expire or you delete them).',
  'We use cookies to keep you logged in, remember your preferences, and understand how visitors use Trip Guide so we can improve the experience. We categorise our cookies into essential (required for the site to function) and analytical (help us measure and improve performance).',
  'These cookies are strictly necessary for the operation of Trip Guide. They include session cookies that maintain your login state, security tokens that protect against cross-site attacks, and preference cookies that remember your cookie consent choice. These cannot be disabled.',
  'When you consent to analytical cookies, we use them to collect anonymised usage data — such as which pages are visited most, how long sessions last, and which features are popular. This data helps us prioritise improvements. No personal information is sold or shared with advertisers.',
  'Session cookies expire when you close your browser. Our login session cookie persists for 24 hours. Cookie consent preferences are stored for 12 months. Analytical cookies typically expire after 30 days. You can clear cookies at any time through your browser settings.',
  'We use minimal third-party cookies. Our AI advice provider (OpenAI) does not set cookies on your device. If we integrate analytics tools in the future, they will only be activated with your explicit consent and will be listed here with their purpose and duration.',
  'You can manage your cookie preferences at any time using the cookie banner (accessible via the "Manage" button when it appears) or through your browser settings. Most browsers allow you to block or delete cookies. Note that blocking essential cookies will prevent you from using Trip Guide.',
  'If you disable essential cookies, you will not be able to log in or maintain a session on Trip Guide. Disabling analytical cookies has no impact on functionality — the site will work normally, but we will have less insight into how to improve it for you and other users.',
  'We may update this Cookie Policy periodically to reflect changes in the cookies we use or for regulatory reasons. Any changes will be posted on this page with an updated "Last updated" date. We encourage you to review this policy occasionally.',
  'If you have questions about our use of cookies, please contact us at privacy@tripguide.app. We are happy to provide additional information about the specific cookies in use and their purposes.',
]

export default function CookiePolicyContent() {
  return (
    <>
      <header className="page-header page-header-legal">
        <a href="/profile" className="page-header-btn" aria-label="Back">
          <IconArrowLeft />
        </a>
        <div className="page-brand">
          <Image src="/app-icon.png" alt="" width={22} height={22} className="page-brand-icon" aria-hidden="true" />
          <span className="page-brand-label">Trip Guide</span>
        </div>
        <div style={{ width: 36 }} />
      </header>

      <div className="page-body">
        <div className="terms-content">
          <h1 className="legal-page-title">Cookie Policy</h1>
          <p className="terms-updated">Last updated: 15 August 2026</p>
          {SECTIONS.map((title, i) => (
            <div key={i} className="terms-section">
              <h2 className="terms-section-title">{title}</h2>
              <p className="terms-para">{PARAGRAPHS[i]}</p>
            </div>
          ))}
        </div>
        <AppFooter />
      </div>
    </>
  )
}
