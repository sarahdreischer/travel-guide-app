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
  'Acceptance of Terms',
  'Use of the Service',
  'User Accounts',
  'AI-Generated Content',
  'Third-Party Content & Images',
  'Privacy & Data',
  'Intellectual Property',
  'Disclaimers',
  'Limitation of Liability',
  'Changes to Terms',
  'Governing Law',
  'Contact',
]

const PARAGRAPHS = [
  'By accessing or using Trip Guide ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use the Service. These terms apply to all visitors, users, and others who access or use the Service. If you are using the Service on behalf of an organisation, you represent that you have the authority to bind that organisation to these terms.',
  'Trip Guide provides AI-generated travel advice and recommendations based on user-provided trip parameters. The Service is intended for informational and planning purposes only. You agree to use the Service in compliance with all applicable laws and regulations, and not to use it for any unlawful, harmful, or fraudulent purpose. You must not attempt to circumvent any rate limits, security measures, or access controls.',
  'To use certain features of the Service, you must create an account. You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You agree to provide accurate and complete registration information and to keep it up to date. We reserve the right to suspend or terminate accounts that violate these terms or remain inactive for extended periods.',
  'Trip Guide uses artificial intelligence (including OpenAI models) to generate travel advice. AI-generated content is provided "as is" for informational purposes only. We do not guarantee the accuracy, completeness, timeliness, or reliability of AI-generated advice. Travel conditions change frequently, and you should always verify critical information (safety alerts, visa requirements, health advisories) with official government and local sources before making travel decisions. Trip Guide and its creators are not liable for any loss, injury, or inconvenience arising from reliance on AI-generated content.',
  'The Service displays destination photographs sourced from Unsplash (unsplash.com) via their API. These photographs are provided by independent photographers under the Unsplash License and remain the intellectual property of their respective creators. Photos are attributed to their photographers and linked to their Unsplash profiles where displayed. Unsplash and its contributors provide photos "as is" without warranty. We do not claim ownership of third-party photographic content. By using the Service, you acknowledge that Unsplash may collect anonymised photo interaction data (views, downloads) via image URLs to improve their service, as described in the Unsplash Privacy Policy. This data collection uses random identifiers and does not identify you personally.',
  'We collect and process personal data as described in our Privacy Policy. Information you provide (name, email, trip details) is used to operate the Service and generate personalised advice. We share limited data with third-party service providers: OpenAI (trip parameters for advice generation, not personal identity data), Unsplash (anonymised image interaction data via hotlinked URLs), and our email provider (your email address for transactional messages such as password resets). We do not sell your personal data to advertisers or data brokers.',
  'The Trip Guide name, logo, and original software code are the property of Trip Guide. AI-generated text content is provided for your personal use. Destination photographs are the property of their respective photographers and are used under the Unsplash License — you may not extract, redistribute, or sublicense these images outside of the Service. All other trademarks, logos, and brand names appearing in the Service belong to their respective owners.',
  'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE. THIRD-PARTY CONTENT, INCLUDING PHOTOGRAPHS AND AI-GENERATED TEXT, MAY CONTAIN INACCURACIES. YOU USE THE SERVICE AT YOUR OWN RISK.',
  'TO THE FULLEST EXTENT PERMITTED BY LAW, TRIP GUIDE, ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE. OUR TOTAL AGGREGATE LIABILITY SHALL NOT EXCEED THE AMOUNT YOU HAVE PAID US IN THE TWELVE MONTHS PRECEDING THE EVENT GIVING RISE TO LIABILITY, OR £100, WHICHEVER IS GREATER.',
  'We may update these Terms of Service from time to time. Material changes will be communicated by posting the revised terms with a new "Last updated" date. Your continued use of the Service after changes become effective constitutes acceptance of the revised terms. We encourage you to review these terms periodically.',
  'These Terms of Service are governed by and construed in accordance with the laws of England and Wales. Any disputes arising from these terms or the Service shall be subject to the exclusive jurisdiction of the courts of England and Wales, without regard to conflict of law principles.',
  'If you have questions about these Terms of Service, please contact us at legal@tripguide.app. For privacy-related enquiries, see our Privacy Policy or email privacy@tripguide.app.',
]

export default function TermsContent() {
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
          <h1 className="legal-page-title">Terms of Service</h1>
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
