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
  'Acceptance of Terms',
  'Use of the Service',
  'User Accounts',
  'Privacy & Data',
  'Intellectual Property',
  'Disclaimers',
  'Limitation of Liability',
  'Changes to Terms',
  'Governing Law',
  'Contact',
]

const PARAGRAPHS = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
  'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis molestie dictum semper, enim lorem fringilla turpis, dictum pharetra libero dui nec eros.',
  'Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Proin vel ante a orci tempus eleifend ut et magna. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus luctus urna sed urna ultricies ac tempor dui sagittis.',
  'In condimentum facilisis porta. Sed nec diam eu diam mattis viverra. Nulla fringilla, orci ac euismod semper, magna diam porttitor mauris, quis sollicitudin sapien justo in libero. Vestibulum mollis mauris enim. Morbi euismod magna ac lorem rutrum elementum.',
  'Donec viverra mi quis quam. In pellentesque massa placerat dui. Aenean scelerisque aliquet odio. Integer vitae nibh elit. Nulla eget dolor vehicula nisi mattis consequat. Aliquam erat volutpat. Phasellus feugiat vulputate enim, sit amet sodales turpis lobortis eu.',
  'Fusce consequat. Nulla nisl. Nunc nisl. Duis bibendum, felis sed interdum venenatis, turpis enim blandit mi, in porttitor pede justo eu massa. Donec dui, consequat in, commodo a, commodo vel, arcu. Proin condimentum, ipsum at sagittis commodo, nunc dui faucibus arcu, non fringilla metus nisl non tellus.',
  'Phasellus fermentum in, dolor. Pellentesque facilisis. Nulla imperdiet sit amet magna. Vestibulum dapibus, mauris nec malesuada fames ac turpis velit, rhoncus eu, luctus et interdum adipiscing wisi. Aliquam erat ac ipsum. Integer aliquam purus. Quisque lorem tortor fringilla sed.',
  'Vestibulum elementum felis sit amet ante. In in orci fringilla hendrerit. Morbi scelerisque luctus velit. Sed malesuada porttitor risus. Etiam quis urna. Phasellus at dui in ligula mollis ultricies. Integer placerat tristique nisl. Praesent augue. Fusce commodo.',
  'Pellentesque ut neque. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. In dui magna, posuere eget, vestibulum et, tempor auctor, justo. In ac felis quis tortor malesuada pretium. Pellentesque auctor neque.',
  'Aenean ligula eget dolor. Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec quam felis, ultricies nec, pellentesque eu, pretium quis, sem. Nulla consequat massa quis enim. Donec pede justo, fringilla vel, aliquet nec, vulputate eget, arcu.',
]

export default function TermsContent() {
  return (
    <>
      <header className="page-header">
        <a href="/profile" className="page-header-btn" aria-label="Back">
          <IconArrowLeft />
        </a>
        <span className="page-title" style={{ fontSize: 15 }}>Terms &amp; Conditions</span>
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
