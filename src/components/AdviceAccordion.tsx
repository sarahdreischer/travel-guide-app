'use client'

import { useState } from 'react'
import type { GroupSection } from '@/lib/category-groups'
import { cleanSubLabel } from '@/lib/category-groups'
import { findAnswer } from '@/lib/answer-lookup'

interface AdviceAccordionProps {
  groups: GroupSection[]
}

// ─── Icons ────────────────────────────────────────────────────────────────────

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

// ─── Group icons ─────────────────────────────────────────────────────────────

const GROUP_ICONS: Record<string, React.ReactElement> = {
  transport: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-4h10l2 4h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/>
    </svg>
  ),
  accommodation: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  money: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/><path d="M12 6v12M9 9a3 3 0 0 1 6 0c0 1.5-1.5 2-3 3s-3 1.5-3 3a3 3 0 0 0 6 0"/>
    </svg>
  ),
  daily: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
    </svg>
  ),
  health: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  activities: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
    </svg>
  ),
  weather: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
    </svg>
  ),
  culture: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
}

// ─── Group row ────────────────────────────────────────────────────────────────

function GroupRow({ group, index }: { group: GroupSection; index: number }) {
  const [open, setOpen] = useState(false)
  const hasContent = group.sources.some((s) => s.subQuestions.length > 0)
  const multiSource = group.sources.length > 1
  const icon = GROUP_ICONS[group.id]

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

        <div className="category-row-body">
          <div className="category-row-name-row">
            {icon && <span className="category-row-icon">{icon}</span>}
            <span className="category-row-name">{group.name}</span>
          </div>
          <span className="category-row-tip">
            {group.keyTip ?? (hasContent ? 'Tap to read' : 'Not yet available')}
          </span>
        </div>

        {hasContent && (
          <span className="category-row-chevron">
            {open ? <IconChevronDown /> : <IconChevronRight />}
          </span>
        )}
      </button>

      {open && hasContent && (
        <div className="category-detail-body">
          {/* Lead block — group name label + first key tip in a callout */}
          <div className="category-lead">
            <p className="category-lead-label">{group.name}</p>
            {group.keyTip && (
              <div className="category-lead-callout">
                <p className="category-lead-tip">{group.keyTip}</p>
              </div>
            )}
          </div>

          {/* Q&A list, with teal sub-labels when multiple source categories */}
          <div className="category-qa-list">
            {group.sources.map((source) => (
              <div key={source.category}>
                {multiSource && source.subQuestions.length > 0 && (
                  <p className="category-sub-label">
                    {cleanSubLabel(source.category)}
                  </p>
                )}
                {source.subQuestions.map((question) => {
                  const answer =
                    findAnswer(source.answers, question) ??
                    null
                  return (
                    <div key={question} className="category-qa-item">
                      <p className="category-qa-q">{question}</p>
                      <p className="category-qa-a">
                        {answer || (
                          <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                            Not available
                          </span>
                        )}
                      </p>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdviceAccordion({ groups }: AdviceAccordionProps) {
  return (
    <div className="category-list">
      {groups.map((group, i) => (
        <GroupRow key={group.id} group={group} index={i} />
      ))}
    </div>
  )
}
