'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import Image from 'next/image'
import { DESTINATIONS } from '@/lib/destinations'
import { createTripAction, CreateTripResult } from '@/actions/trip'

// ─── Constants ────────────────────────────────────────────────────────────────

const PARTY_OPTIONS = ['Solo', 'Couple', 'Friends', 'Family'] as const

const TRANSPORT_MODES = [
  {
    id: 'fly', label: 'Fly', tagline: 'Fastest way there',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19 4c-1 0-2 .5-2.5 1L13 8.8 4.8 6.2l-1.9 1.9L8 12l-3 3H3l-1 1.5L5 18l1.5 2L8 19l1-1v-2l3-3 3.2 4.2 1.9-1.9z" />
      </svg>
    ),
  },
  {
    id: 'drive', label: 'Drive', tagline: 'Freedom to explore',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-4h10l2 4h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2" />
        <circle cx="7.5" cy="17.5" r="2.5" /><circle cx="16.5" cy="17.5" r="2.5" />
      </svg>
    ),
  },
  {
    id: 'rail', label: 'Rail', tagline: 'Scenic & seamless',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="3" width="16" height="13" rx="2" />
        <path d="M4 11h16M12 3v10M8 20l4-3 4 3" />
        <circle cx="8.5" cy="17" r="1" /><circle cx="15.5" cy="17" r="1" />
      </svg>
    ),
  },
  {
    id: 'sail', label: 'Sail', tagline: 'Uncharted routes',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 17h18M12 3v14M12 3C7 7 5 13 5 17h7M12 3c5 4 7 10 7 14h-7" />
      </svg>
    ),
  },
] as const

const TRAVEL_STYLES = ['Adventure', 'Relaxed', 'Cultural', 'Luxury', 'Budget', 'Family'] as const

const ACTIVITY_OPTIONS = [
  'Cycling',
  'Food tours',
  'Freediving',
  'Hiking',
  'Museums',
  'Nightlife',
  'Paddleboarding',
  'Photography',
  'Rock climbing',
  'Scuba diving',
  'Snorkelling',
  'Surfing',
  'Sailing',
  'Skiing',
  'Swimming',
  'Wildlife',
  'Yoga',
] as const

const STEPS = [
  { label: 'Where to?', subtitle: 'Pick your destination and travel dates.' },
  { label: 'How you travel', subtitle: "We'll tailor the advice to your style." },
  { label: 'What excites you?', subtitle: 'Your interests sharpen the recommendations.' },
]

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1498637841888-108c6b723fcb?w=1080&q=80&fit=crop'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WizardData {
  destination: string
  startDate: string
  endDate: string
  party: string
  transportMode: string
  budget: string
  travelStyle: string[]
  activities: string[]
}

const EMPTY: WizardData = {
  destination: '', startDate: '', endDate: '', party: '',
  transportMode: '', budget: '', travelStyle: [], activities: [],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDuration(start: string, end: string): string {
  if (!start || !end) return ''
  const diff = (new Date(end).getTime() - new Date(start).getTime()) / 86400000
  if (diff <= 0) return ''
  return `${Math.round(diff)} night${diff !== 1 ? 's' : ''}`
}

function fmtDate(iso: string): string {
  if (!iso) return ''
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function IconArrowLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  )
}

// ─── Step 1 ───────────────────────────────────────────────────────────────────

function Step1({ form, setForm, destImg }: {
  form: WizardData
  setForm: React.Dispatch<React.SetStateAction<WizardData>>
  destImg: string | null
}) {
  const [query, setQuery] = useState(form.destination)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const filtered = query.length > 0
    ? [...DESTINATIONS].filter((d) => d.toLowerCase().includes(query.toLowerCase()))
    : [...DESTINATIONS]
  const duration = getDuration(form.startDate, form.endDate)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    function onOut(e: MouseEvent) { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [])

  return (
    <div className="form-stack">
      <div className="field-block">
        <label className="field-label" htmlFor="dest-input">Where are you headed?</label>
        <div className="dest-wrapper" ref={wrapRef}>
          <input id="dest-input" type="text" className="field-input" placeholder="Country or city" autoComplete="off"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setForm((f) => ({ ...f, destination: '' })); setOpen(true) }}
            onFocus={() => setOpen(true)} aria-autocomplete="list" aria-expanded={open && filtered.length > 0} />
          {open && filtered.length > 0 && (
            <ul className="dest-dropdown" role="listbox" aria-label="Destinations">
              {filtered.map((d) => (
                <li key={d} className="dest-item" role="option" aria-selected={form.destination === d}
                  onMouseDown={() => { setForm((f) => ({ ...f, destination: d })); setQuery(d); setOpen(false) }}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Destination image reveal */}
      {form.destination && destImg && (
        <div className="dest-reveal" aria-hidden="true">
          <img className="dest-reveal-img" src={destImg} alt="" />
          <div className="dest-reveal-scrim" />
          <div className="dest-reveal-meta">
            <p className="dest-reveal-name">{form.destination}</p>
            <p className="dest-reveal-ready">Ready when you are</p>
          </div>
        </div>
      )}

      <div className="field-block">
        <label className="field-label">Who&apos;s coming with you?</label>
        <div className="chip-group" role="group" aria-label="Travel party">
          {PARTY_OPTIONS.map((p) => (
            <button key={p} type="button" className={`chip ${form.party === p ? 'chip-on' : 'chip-idle'}`}
              aria-pressed={form.party === p} onClick={() => setForm((f) => ({ ...f, party: p }))}>{p}</button>
          ))}
        </div>
      </div>

      <div className="field-block">
        <label className="field-label">When are you going?</label>
        <div className="date-row">
          <input type="date" className="field-input" aria-label="Start date" value={form.startDate} min={today}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
          <span className="date-row-sep" aria-hidden="true">→</span>
          <input type="date" className="field-input" aria-label="End date" value={form.endDate} min={form.startDate || today}
            onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
        </div>
        {duration && <p className="duration-tag" aria-live="polite">{duration}</p>}
      </div>
    </div>
  )
}

// ─── Step 2 ───────────────────────────────────────────────────────────────────

function Step2({ form, setForm }: {
  form: WizardData
  setForm: React.Dispatch<React.SetStateAction<WizardData>>
}) {
  return (
    <div className="form-stack">
      <div className="field-block">
        <label className="field-label">How are you getting there?</label>
        <div className="mode-grid" role="group" aria-label="Primary travel mode">
          {TRANSPORT_MODES.map((m) => (
            <button key={m.id} type="button"
              className={`mode-btn ${form.transportMode === m.id ? 'mode-btn-on' : 'mode-btn-idle'}`}
              aria-pressed={form.transportMode === m.id}
              onClick={() => setForm((f) => ({ ...f, transportMode: m.id }))}>
              {m.icon}
              <span className="mode-label">{m.label}</span>
              <span className="mode-tagline">{m.tagline}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field-block">
        <label className="field-label" htmlFor="budget-input">
          What&apos;s your rough budget? <span className="field-label-note">— optional</span>
        </label>
        <div className="budget-wrapper">
          <span className="budget-prefix" aria-hidden="true">$</span>
          <input id="budget-input" type="text" inputMode="numeric" className="field-input budget-input"
            placeholder="0" value={form.budget}
            onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value.replace(/\D/g, '') }))} />
          <span className="budget-suffix" aria-hidden="true">USD</span>
        </div>
        <p className="field-hint">Used to tailor cost advice and recommendations.</p>
      </div>

      <div className="field-block">
        <label className="field-label">What kind of traveller are you? <span className="field-label-note">— select all that apply</span></label>
        <div className="chip-group" role="group" aria-label="Travel style">
          {TRAVEL_STYLES.map((s) => (
            <button key={s} type="button" className={`chip ${form.travelStyle.includes(s) ? 'chip-on' : 'chip-idle'}`}
              aria-pressed={form.travelStyle.includes(s)}
              onClick={() => setForm((f) => ({
                ...f,
                travelStyle: f.travelStyle.includes(s)
                  ? f.travelStyle.filter((x) => x !== s)
                  : [...f.travelStyle, s],
              }))}>{s}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Step 3 ───────────────────────────────────────────────────────────────────

function Step3({ form, setForm, destImg }: {
  form: WizardData
  setForm: React.Dispatch<React.SetStateAction<WizardData>>
  destImg: string | null
}) {
  const toggleActivity = (a: string) => setForm((f) => ({
    ...f,
    activities: f.activities.includes(a) ? f.activities.filter((x) => x !== a) : [...f.activities, a],
  }))
  const duration = getDuration(form.startDate, form.endDate)

  return (
    <div className="form-stack">
      <div className="field-block">
        <label className="field-label">What do you love doing? <span className="field-label-note">— pick at least one</span></label>
        <div className="chip-group" role="group" aria-label="Activity preferences">
          {ACTIVITY_OPTIONS.map((a) => (
            <button key={a} type="button" className={`chip ${form.activities.includes(a) ? 'chip-on' : 'chip-idle'}`}
              aria-pressed={form.activities.includes(a)} onClick={() => toggleActivity(a)}>{a}</button>
          ))}
        </div>
      </div>

      {/* Emotional closing message */}
      {form.destination && form.activities.length > 0 && (
        <div className="trip-ready-msg">
          <p className="trip-ready-text">
            You&apos;re all set. We&apos;ll build a personalised guide for{' '}
            <strong>{form.destination}</strong> — covering everything from getting
            around to local tips, so you can travel with confidence.
          </p>
        </div>
      )}

      {/* Summary panel with hero image */}
      {form.destination && (
        <div className="summary-panel" aria-label="Trip summary">
          <div className="summary-hero">
            <img className="summary-hero-img" src={destImg || FALLBACK_IMAGE} alt={form.destination} />
            <div className="summary-hero-scrim" />
            <p className="summary-hero-label">{form.destination}</p>
          </div>
          <div className="summary-body">
            <div className="summary-row">
              <span className="summary-key">Dates</span>
              <span className="summary-val">
                {fmtDate(form.startDate)} – {fmtDate(form.endDate)}
                {duration && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {duration}</span>}
              </span>
            </div>
            {form.party && <div className="summary-row"><span className="summary-key">Party</span><span className="summary-val">{form.party}</span></div>}
            {form.transportMode && <div className="summary-row"><span className="summary-key">Mode</span><span className="summary-val" style={{ textTransform: 'capitalize' }}>{form.transportMode}</span></div>}
            {form.budget && <div className="summary-row"><span className="summary-key">Budget</span><span className="summary-val">${parseInt(form.budget).toLocaleString()} USD</span></div>}
            {form.travelStyle.length > 0 && <div className="summary-row"><span className="summary-key">Style</span><span className="summary-val">{form.travelStyle.join(', ')}</span></div>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

interface TripFormProps {
  destinationImages?: Record<string, string>
  /** If set, the wizard is in edit mode — pre-populates and updates instead of creating */
  editTripId?: string
  initialData?: Partial<WizardData>
  /** URL to return to on cancel in edit mode */
  cancelHref?: string
}

export default function TripForm({ destinationImages = {}, editTripId, initialData, cancelHref }: TripFormProps) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<WizardData>({ ...EMPTY, ...initialData })
  const [serverErrors, setServerErrors] = useState<(CreateTripResult & { success: false }) | null>(null)
  const [isPending, startTransition] = useTransition()

  const isEditMode = !!editTripId

  const canAdvance1 = form.destination !== '' && form.party !== '' && form.startDate !== '' && form.endDate !== '' && new Date(form.endDate) > new Date(form.startDate)
  const canAdvance2 = form.transportMode !== '' && form.travelStyle.length > 0
  const canSubmit = form.activities.length > 0
  const canContinue = step === 1 ? canAdvance1 : step === 2 ? canAdvance2 : canSubmit

  const destImg = destinationImages[form.destination] || null

  function handleSubmit() {
    const fd = new FormData()
    fd.set('destination', form.destination)
    fd.set('startDate', form.startDate)
    fd.set('endDate', form.endDate)
    fd.set('travelMode', form.party)
    fd.set('transportMode', form.transportMode)
    fd.set('budget', form.budget || '1000')
    fd.set('travelStyle', form.travelStyle.join(', '))
    for (const a of form.activities) fd.append('activityPreferences', a)

    startTransition(async () => {
      let result: CreateTripResult | null = null
      if (isEditMode) {
        const { updateTripAction } = await import('@/actions/update-trip')
        result = await updateTripAction(editTripId!, fd) as CreateTripResult
      } else {
        result = await createTripAction(fd)
      }
      if (result && !result.success) {
        setServerErrors(result)
        const e = result.errors
        if (e.destination || e.startDate || e.endDate || e.travelMode) setStep(1)
        else if (e.budget || e.travelStyle || e.transportMode) setStep(2)
      }
    })
  }

  function handleCancel() {
    if (cancelHref) {
      window.location.href = cancelHref
    }
  }

  return (
    <div className="wizard-shell">
      {/* Header */}
      <header className="wizard-header">
        {step > 1 ? (
          <button className="wizard-back-btn" onClick={() => setStep((s) => s - 1)} aria-label="Back to previous step">
            <IconArrowLeft />
          </button>
        ) : isEditMode ? (
          <button className="wizard-back-btn" onClick={handleCancel} aria-label="Cancel editing">
            <IconArrowLeft />
          </button>
        ) : <div style={{ width: 36 }} />}
        <div className="wizard-brand">
          <Image src="/app-icon.png" alt="" width={22} height={22} className="page-brand-icon" aria-hidden="true" />
          <span className="page-brand-label">Travel Guide</span>
        </div>
        <div className="step-counter" aria-label={`Step ${step} of ${STEPS.length}`}>
          <span className="step-counter-current">{step}</span>
          <span className="step-counter-sep" aria-hidden="true">of</span>
          <span className="step-counter-total">{STEPS.length}</span>
        </div>
        <div style={{ width: 36 }} />
      </header>

      {/* Progress — full width, teal filled, 2px */}
      <div className="wizard-progress-track" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={STEPS.length} aria-label="Form progress">
        <div className="wizard-progress-fill" style={{ width: `${(step / STEPS.length) * 100}%` }} />
      </div>

      {/* Step content */}
      <main className="wizard-step-content" key={step}>
        <div className="wizard-step-heading">
          <p className="wizard-step-eyebrow">Step {step} of {STEPS.length}</p>
          <h1 className="wizard-step-title">{STEPS[step - 1].label}</h1>
          <p className="wizard-step-subtitle">{STEPS[step - 1].subtitle}</p>
        </div>

        {step === 1 && <Step1 form={form} setForm={setForm} destImg={destImg} />}
        {step === 2 && <Step2 form={form} setForm={setForm} />}
        {step === 3 && <Step3 form={form} setForm={setForm} destImg={destImg} />}
      </main>

      {/* Footer — teal CTA on final step */}
      <footer className="wizard-footer">
        <button
          className="wizard-btn-primary"
          style={step === STEPS.length ? { background: 'var(--accent)' } : undefined}
          disabled={!canContinue || isPending}
          aria-disabled={!canContinue || isPending}
          onClick={step < STEPS.length ? () => setStep((s) => s + 1) : handleSubmit}
        >
          {isPending
            ? (isEditMode ? 'Saving…' : 'Creating trip…')
            : step < STEPS.length
            ? 'Continue'
            : (isEditMode ? 'Save changes' : 'Build my travel guide')}
        </button>
        {step === STEPS.length && !isEditMode && (
          <p className="wizard-footer-note">Personalised for your trip · Ready in seconds</p>
        )}
      </footer>
    </div>
  )
}
