'use client'

import AppFooter from '@/components/AppFooter'

function IconArrowLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  )
}

const SECTIONS = [
  'Information We Collect',
  'How We Use Your Information',
  'Data Storage & Security',
  'Cookies & Tracking',
  'Third-Party Services',
  'Data Retention',
  'Your Rights',
  'Children\'s Privacy',
  'Changes to This Policy',
  'Contact Us',
]

const PARAGRAPHS = [
  'We collect information you provide directly when creating an account, such as your name and email address. We also collect trip details you enter (destinations, dates, preferences) to generate personalised travel advice. Technical data like browser type, device information, and usage patterns may be collected automatically to improve the service.',
  'Your information is used to provide personalised travel advice, maintain your account, and improve our service. We use trip details to generate relevant recommendations via AI. We may use aggregated, anonymised data to understand usage patterns and improve the quality of advice across all users.',
  'Your data is stored on secure servers with encryption at rest and in transit. Passwords are hashed using industry-standard bcrypt algorithms and are never stored in plain text. We implement appropriate technical and organisational measures to protect your personal data against unauthorised access, loss, or alteration.',
  'We use essential cookies to maintain your login session and remember your preferences. Analytical cookies, when consented to, help us understand how the app is used so we can improve it. We do not use advertising cookies or sell your data to third parties. You can manage your cookie preferences at any time.',
  'We use OpenAI to generate travel advice based on your trip parameters. Only trip details (destination, dates, travel style) are sent to the AI provider — never your personal identity information. We may use third-party services for email delivery and infrastructure hosting, each bound by data processing agreements.',
  'Your account data is retained for as long as your account is active. Trip data and generated advice are kept for the lifetime of your account. If you delete your account, all personal data is permanently removed within 30 days. Anonymised, aggregated data may be retained for analytical purposes.',
  'You have the right to access, correct, or delete your personal data at any time. You can export your trip data, update your profile information, or delete your account entirely from the Profile page. If you are in the EU/EEA, you have additional rights under GDPR including data portability and the right to object to processing.',
  'Travel Guide is not directed at children under 16. We do not knowingly collect personal information from children. If we become aware that a child has provided us with personal data, we will take steps to delete that information promptly.',
  'We may update this Privacy Policy from time to time to reflect changes in our practices or for legal, operational, or regulatory reasons. We will notify you of any material changes by posting the updated policy with a new "Last updated" date. Your continued use of the service after changes constitutes acceptance.',
  'If you have questions about this Privacy Policy or how we handle your data, please contact us at privacy@travelguide.app. For data protection enquiries within the EU, you may also contact our Data Protection Officer at the same address. We aim to respond to all enquiries within 30 days.',
]

export default function PrivacyContent() {
  return (
    <>
      <header className="page-header">
        <a href="/profile" className="page-header-btn" aria-label="Back">
          <IconArrowLeft />
        </a>
        <span className="page-title" style={{ fontSize: 15 }}>Privacy Policy</span>
        <div style={{ width: 36 }} />
      </header>

      <div className="page-body">
        <div className="terms-content">
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
