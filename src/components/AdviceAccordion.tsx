'use client'

import { useState, useTransition } from 'react'
import type { GroupSection } from '@/lib/category-groups'
import { cleanSubLabel } from '@/lib/category-groups'
import { findAnswer } from '@/lib/answer-lookup'
import { toggleSavedTipAction } from '@/actions/saved-tips'

interface AdviceAccordionProps {
  groups: GroupSection[]
  tripId: string
  /** Set of "category|question" keys that are currently saved */
  savedKeys: Set<string>
  /** Initial count of saved tips (for showing the banner) */
  initialSavedCount: number
}

function makeSavedKey(category: string, question: string) {
  return `${category}|${question}`
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

function IconBookmark({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

// ─── Group icons ─────────────────────────────────────────────────────────────

const GROUP_ICONS: Record<string, React.ReactElement> = {
  transport: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-4h10l2 4h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/></svg>),
  accommodation: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>),
  money: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M9 9a3 3 0 0 1 6 0c0 1.5-1.5 2-3 3s-3 1.5-3 3a3 3 0 0 0 6 0"/></svg>),
  'food-and-drinks': (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>),
  health: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>),
  activities: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>),
  weather: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>),
  connectivity: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>),
  culture: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>),
  'packing-and-preparation': (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 2v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V2M4 22h16a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2zM10 6h4"/></svg>),
  maintenance: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>),
}

// ─── Bookmark button ──────────────────────────────────────────────────────────

function BookmarkBtn({ tripId, category, question, answer, initialSaved, onSavedChange }: {
  tripId: string; category: string; question: string; answer: string; initialSaved: boolean; onSavedChange?: (key: string, saved: boolean) => void
}) {
  const [saved, setSaved] = useState(initialSaved)
  const [pending, startTransition] = useTransition()

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation()
    startTransition(async () => {
      const result = await toggleSavedTipAction({ tripId, category, question, answer })
      setSaved(result.saved)
      onSavedChange?.(makeSavedKey(category, question), result.saved)
    })
  }

  return (
    <button
      type="button"
      className={`bookmark-btn${saved ? ' bookmark-btn-saved' : ''}`}
      onClick={handleToggle}
      disabled={pending}
      aria-label={saved ? 'Remove from saved tips' : 'Save this tip'}
      aria-pressed={saved}
    >
      <IconBookmark filled={saved} />
    </button>
  )
}

// ─── Group row ────────────────────────────────────────────────────────────────

function GroupRow({ group, index, tripId, savedKeys, onSavedChange }: {
  group: GroupSection; index: number; tripId: string; savedKeys: Set<string>; onSavedChange: (key: string, saved: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  // -1 means "All" tab; 0+ means individual source tabs
  const [activeTab, setActiveTab] = useState(-1)
  const hasContent = group.sources.some((s) => s.subQuestions.length > 0)
  const multiSource = group.sources.length > 1
  const icon = GROUP_ICONS[group.id]

  // Determine which sources to show based on active tab
  const visibleSources = activeTab === -1
    ? group.sources
    : [group.sources[activeTab] ?? group.sources[0]]

  return (
    <div className="category-row-wrap">
      <button
        type="button"
        className="category-row"
        aria-expanded={open}
        onClick={() => hasContent && setOpen((v) => !v)}
        style={!hasContent ? { cursor: 'default' } : undefined}
      >
        <span className="category-row-num">{String(index + 1).padStart(2, '0')}</span>
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
          <div className="category-lead">
            <p className="category-lead-label">{group.name}</p>
            {group.keyTip && (
              <div className="category-lead-callout">
                <p className="category-lead-tip">{group.keyTip}</p>
              </div>
            )}
          </div>

          {multiSource && (
            <div className="category-tabs" role="tablist" aria-label={`${group.name} sections`}>
              <button type="button" role="tab" aria-selected={activeTab === -1}
                className={`category-tab${activeTab === -1 ? ' category-tab-active' : ''}`}
                onClick={() => setActiveTab(-1)}>All</button>
              {group.sources.map((source, i) => (
                <button key={source.category} type="button" role="tab" aria-selected={i === activeTab}
                  className={`category-tab${i === activeTab ? ' category-tab-active' : ''}`}
                  onClick={() => setActiveTab(i)}>{cleanSubLabel(source.category)}</button>
              ))}
            </div>
          )}

          <div className="category-qa-list" role="tabpanel">
            {visibleSources.map((source) => (
              <div key={source.category}>
                {activeTab === -1 && multiSource && (
                  <p className="category-sub-label">{cleanSubLabel(source.category)}</p>
                )}
                {source.subQuestions.map((question) => {
                  const answer = findAnswer(source.answers, question) ?? null
                  const key = makeSavedKey(source.category, question)
                  return (
                    <div key={question} className="category-qa-item">
                      <div className="category-qa-header">
                        <p className="category-qa-q">{question}</p>
                        {answer && (
                          <BookmarkBtn
                            tripId={tripId}
                            category={source.category}
                            question={question}
                            answer={answer}
                            initialSaved={savedKeys.has(key)}
                            onSavedChange={onSavedChange}
                          />
                        )}
                      </div>
                      <p className="category-qa-a">
                        {answer || <span className="category-qa-empty">Not available</span>}
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

export default function AdviceAccordion({ groups, tripId, savedKeys: initialSavedKeys, initialSavedCount }: AdviceAccordionProps) {
  const [savedKeys, setSavedKeys] = useState<Set<string>>(initialSavedKeys)
  const savedCount = savedKeys.size || initialSavedCount

  function handleSavedChange(key: string, saved: boolean) {
    setSavedKeys((prev) => {
      const next = new Set(prev)
      if (saved) next.add(key)
      else next.delete(key)
      return next
    })
  }

  return (
    <>
      {savedCount > 0 && (
        <div className="saved-tips-entry">
          <a href={`/home/${tripId}/saved`} className="saved-tips-link">
            <span className="saved-tips-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </span>
            <span className="saved-tips-label">Saved tips</span>
            <span className="saved-tips-count">{savedCount}</span>
          </a>
        </div>
      )}
      <div className="category-list">
        {groups.map((group, i) => (
          <GroupRow key={group.id} group={group} index={i} tripId={tripId} savedKeys={savedKeys} onSavedChange={handleSavedChange} />
        ))}
      </div>
    </>
  )
}
