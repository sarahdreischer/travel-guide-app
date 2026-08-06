'use client'

import { useState } from 'react'
import type { CategorySection } from '@/app/(app)/home/[tripId]/page'

interface AdviceAccordionProps {
  sections: CategorySection[]
}

function IconChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

function IconChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function CategoryRow({
  section,
  index,
}: {
  section: CategorySection
  index: number
}) {
  const [open, setOpen] = useState(false)
  const hasContent = section.subQuestions.length > 0

  return (
    <div className="category-row-wrap">
      <button
        type="button"
        className="category-row"
        aria-expanded={open}
        onClick={() => hasContent && setOpen((v) => !v)}
        style={!hasContent ? { cursor: 'default' } : undefined}
      >
        <span className="category-row-num">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="category-row-body">
          <span className="category-row-name">{section.category}</span>
          <span className="category-row-tip">
            {section.conciseTip ?? (section.answers ? 'Tap to read' : 'Not yet available')}
          </span>
        </span>
        {hasContent && (
          <span className="category-row-chevron">
            {open ? <IconChevronDown /> : <IconChevronRight />}
          </span>
        )}
      </button>

      {open && hasContent && (
        <div className="category-detail-body">
          <div className="category-lead">
            <p className="category-lead-label">{section.category}</p>
            {section.conciseTip && (
              <p className="category-lead-tip">{section.conciseTip}</p>
            )}
          </div>
          <div className="category-qa-list">
            {section.subQuestions.map((question) => {
              const answer =
                section.answers?.[question] ??
                Object.entries(section.answers ?? {}).find(
                  ([k]) => k.toLowerCase().trim() === question.toLowerCase().trim()
                )?.[1] ??
                null
              return (
                <div key={question} className="category-qa-item">
                  <p className="category-qa-q">{question}</p>
                  <p className="category-qa-a">
                    {answer || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Not available</span>}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdviceAccordion({ sections }: AdviceAccordionProps) {
  const visible = sections.filter((s) => s.subQuestions.length > 0)

  return (
    <div className="category-list">
      {visible.map((section, i) => (
        <CategoryRow key={section.category} section={section} index={i} />
      ))}
    </div>
  )
}
