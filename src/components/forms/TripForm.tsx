'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { DESTINATIONS } from '@/lib/destinations'
import { createTripAction, CreateTripResult } from '@/actions/trip'

// ─── Constants ────────────────────────────────────────────────────────────────

// Must match VALID_TRAVEL_MODES in actions/trip.ts
const PARTY_OPTIONS = ['Solo', 'Couple', 'Friends', 'Family'] as const

// Must match VALID_TRANSPORT_MODES in actions/trip.ts
const TRANSPORT_MODES = [
  {
    id: 'fly',
    label: 'Fly',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19 4c-1 0-2 .5-2.5 1L13 8.8 4.8 6.2l-1.9 1.9L8 12l-3 3H3l-1 1.5L5 18l1.5 2L8 19l1-1v-2l3-3 3.2 4.2 1.9-1.9z" />
      </svg>
    ),
  },
  {
    id: 'drive',
    label: 'Drive',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-4h10l2 4h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2" />
        <circle cx="7.5" cy="17.5" r="2.5" />
        <circle cx="16.5" cy="17.5" r="2.5" />
      </svg>
    ),
  },
  {
    id: 'rail',
    label: 'Rail',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="3" width="16" height="13" rx="2" />
        <path d="M4 11h16M12 3v10M8 20l4-3 4 3" />
        <circle cx="8.5" cy="17" r="1" />
        <circle cx="15.5" cy="17" r="1" />
      </svg>
    ),
  },
  {
    id: 'sail',
    label: 'Sail',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 17h18M12 3v14M12 3C7 7 5 13 5 17h7M12 3c5 4 7 10 7 14h-7" />
      </svg>
    ),
  },
] as const

// Must match VALID_TRAVEL_STYLES in actions/trip.ts
const TRAVEL_STYLES = [
  'Adventure',
  'Relaxed',
  'Cultural',
  'Luxury',
  'Budget',
  'Family',
] as const

const ACTIVITY_OPTIONS = [
  'Hiking', 'Swimming', 'Surfing', 'Cycling', 'Snorkelling',
  'Rock climbing', 'Yoga', 'Museums', 'Food tours', 'Nightlife',
  'Photography', 'Wildlife', 'Sailing', 'Skiing',
] as const

const STEPS = [
  { label: 'Where & When' },
  { label: 'Your trip' },
  { label: 'Interests' },
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface WizardData {
  destination: string
  startDate: string
  endDate: string
  party: string        // maps to travelMode (Solo/Couple/Friends/Family)
  transportMode: string // fly | drive | rail | sail
  budget: string
  travelStyle: string
  activities: string[]
}

const EMPTY: WizardData = {
  destination: '',
  startDate: '',
  endDate: '',
  party: '',
  transportMode: '',
  budget: '',
  travelStyle: '',
  activities: [],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDuration(start: string, end: string): string {
  if (!start || !end) return ''
  const diff = (new Date(end).getTime() - new Date(start).getTime()) / 86400000
  if (diff <= 0) return ''
  return `${Math.round(diff)} night${diff !== 1 ? 's' : ''}`
}

function fmtDate(iso: string): string {
  if (!iso) return ''
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconArrowLeft() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  )
}

// ─── Step 1: Where & When ─────────────────────────────────────────────────────

function Step1({
  form,
  setForm,
  errors,
}: {
  form: WizardData
  setForm: React.Dispatch<React.SetStateAction<WizardData>>
  errors?: { destination?: string; startDate?: string; endDate?: string; travelMode?: string }
}) {
  const [query, setQuery] = useState(form.destination)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const filtered =
    query.length > 0
      ? [...DESTINATIONS].filter((d) => d.toLowerCase().includes(query.toLowerCase()))
      : [...DESTINATIONS]

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const duration = getDuration(form.startDate, form.endDate)
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="form-stack">
      {/* Destination */}
      <div className="field-block">
        <label className="field-label" htmlFor="dest-input">
          Destination
        </label>
        <div className="dest-wrapper" ref={wrapRef}>
          <input
            id="dest-input"
            type="text"
            className="field-input"
            placeholder="Country or city"
            autoComplete="off"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setForm((f) => ({ ...f, destination: '' }))
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            aria-autocomplete="list"
            aria-expanded={open && filtered.length > 0}
            aria-describedby={errors?.destination ? 'dest-error' : undefined}
          />
          {open && filtered.length > 0 && (
            <ul className="dest-dropdown" role="listbox" aria-label="Destinations">
              {filtered.map((d) => (
                <li
                  key={d}
                  className="dest-item"
                  role="option"
                  aria-selected={form.destination === d}
                  onMouseDown={() => {
                    setForm((f) => ({ ...f, destination: d }))
                    setQuery(d)
                    setOpen(false)
                  }}
                >
                  {d}
                </li>
              ))}
            </ul>
          )}
        </div>
        {errors?.destination && (
          <p id="dest-error" role="alert" className="field-error">
            {errors.destination}
          </p>
        )}
      </div>

      {/* Travelling as (maps to travelMode) */}
      <div className="field-block">
        <label className="field-label">Travelling as</label>
        <div
          className="chip-group"
          role="group"
          aria-label="Travel party"
          aria-describedby={errors?.travelMode ? 'party-error' : undefined}
        >
          {PARTY_OPTIONS.map((p) => (
            <button
              key={p}
              type="button"
              className={`chip ${form.party === p ? 'chip-on' : 'chip-idle'}`}
              aria-pressed={form.party === p}
              onClick={() => setForm((f) => ({ ...f, party: p }))}
            >
              {p}
            </button>
          ))}
        </div>
        {errors?.travelMode && (
          <p id="party-error" role="alert" className="field-error">
            {errors.travelMode}
          </p>
        )}
      </div>

      {/* Dates */}
      <div className="field-block">
        <label className="field-label">Travel dates</label>
        <div className="date-row">
          <input
            type="date"
            className="field-input"
            aria-label="Start date"
            value={form.startDate}
            min={today}
            aria-describedby={errors?.startDate ? 'start-date-error' : undefined}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
          />
          <span className="date-row-sep" aria-hidden="true">
            →
          </span>
          <input
            type="date"
            className="field-input"
            aria-label="End date"
            value={form.endDate}
            min={form.startDate || today}
            aria-describedby={errors?.endDate ? 'end-date-error' : undefined}
            onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
          />
        </div>
        {duration && (
          <p className="duration-tag" aria-live="polite">
            {duration}
          </p>
        )}
        {errors?.startDate && (
          <p id="start-date-error" role="alert" className="field-error">
            {errors.startDate}
          </p>
        )}
        {errors?.endDate && (
          <p id="end-date-error" role="alert" className="field-error">
            {errors.endDate}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Step 2: Your trip ────────────────────────────────────────────────────────

function Step2({
  form,
  setForm,
  errors,
}: {
  form: WizardData
  setForm: React.Dispatch<React.SetStateAction<WizardData>>
  errors?: { budget?: string; travelStyle?: string; transportMode?: string }
}) {
  return (
    <div className="form-stack">
      {/* Primary travel mode */}
      <div className="field-block">
        <label className="field-label">Primary travel mode</label>
        <div
          className="mode-grid"
          role="group"
          aria-label="Primary travel mode"
          aria-describedby={errors?.transportMode ? 'transport-error' : undefined}
        >
          {TRANSPORT_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`mode-btn ${form.transportMode === m.id ? 'mode-btn-on' : 'mode-btn-idle'}`}
              aria-pressed={form.transportMode === m.id}
              onClick={() => setForm((f) => ({ ...f, transportMode: m.id }))}
            >
              {m.icon}
              <span className="mode-label">{m.label}</span>
            </button>
          ))}
        </div>
        {errors?.transportMode && (
          <p id="transport-error" role="alert" className="field-error">
            {errors.transportMode}
          </p>
        )}
      </div>
      {/* Budget */}
      <div className="field-block">
        <label className="field-label" htmlFor="budget-input">
          Approximate budget
          <span className="field-label-note">— optional</span>
        </label>
        <div className="budget-wrapper">
          <span className="budget-prefix" aria-hidden="true">
            $
          </span>
          <input
            id="budget-input"
            type="text"
            inputMode="numeric"
            className="field-input budget-input"
            placeholder="0"
            value={form.budget}
            aria-describedby={errors?.budget ? 'budget-error' : undefined}
            onChange={(e) =>
              setForm((f) => ({ ...f, budget: e.target.value.replace(/\D/g, '') }))
            }
          />
          <span className="budget-suffix" aria-hidden="true">
            USD
          </span>
        </div>
        <p className="field-hint">Used to tailor cost advice and recommendations.</p>
        {errors?.budget && (
          <p id="budget-error" role="alert" className="field-error">
            {errors.budget}
          </p>
        )}
      </div>

      {/* Travel style */}
      <div className="field-block">
        <label className="field-label">
          Travel style
          <span className="field-label-note">— pick one</span>
        </label>
        <div
          className="chip-group"
          role="group"
          aria-label="Travel style"
          aria-describedby={errors?.travelStyle ? 'style-error' : undefined}
        >
          {TRAVEL_STYLES.map((s) => (
            <button
              key={s}
              type="button"
              className={`chip ${form.travelStyle === s ? 'chip-on' : 'chip-idle'}`}
              aria-pressed={form.travelStyle === s}
              onClick={() => setForm((f) => ({ ...f, travelStyle: s }))}
            >
              {s}
            </button>
          ))}
        </div>
        {errors?.travelStyle && (
          <p id="style-error" role="alert" className="field-error">
            {errors.travelStyle}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Step 3: Interests ────────────────────────────────────────────────────────

function Step3({
  form,
  setForm,
  errors,
}: {
  form: WizardData
  setForm: React.Dispatch<React.SetStateAction<WizardData>>
  errors?: { activityPreferences?: string }
}) {
  const toggleActivity = (a: string) => {
    setForm((f) => ({
      ...f,
      activities: f.activities.includes(a)
        ? f.activities.filter((x) => x !== a)
        : [...f.activities, a],
    }))
  }

  const duration = getDuration(form.startDate, form.endDate)

  return (
    <div className="form-stack">
      {/* Activities */}
      <div className="field-block">
        <label className="field-label">
          Activity preferences
          <span className="field-label-note">— select at least one</span>
        </label>
        <div
          className="chip-group"
          role="group"
          aria-label="Activity preferences"
          aria-describedby={errors?.activityPreferences ? 'activities-error' : undefined}
        >
          {ACTIVITY_OPTIONS.map((a) => (
            <button
              key={a}
              type="button"
              className={`chip ${form.activities.includes(a) ? 'chip-on' : 'chip-idle'}`}
              aria-pressed={form.activities.includes(a)}
              onClick={() => toggleActivity(a)}
            >
              {a}
            </button>
          ))}
        </div>
        {errors?.activityPreferences && (
          <p id="activities-error" role="alert" className="field-error">
            {errors.activityPreferences}
          </p>
        )}
      </div>

      {/* Trip summary */}
      {form.destination && (
        <div className="summary-panel" aria-label="Trip summary">
          <p className="summary-header">Trip summary</p>

          <div className="summary-row">
            <span className="summary-key">Destination</span>
            <span className="summary-val">{form.destination}</span>
          </div>

          <div className="summary-row">
            <span className="summary-key">Dates</span>
            <span className="summary-val">
              {fmtDate(form.startDate)} – {fmtDate(form.endDate)}
              {duration && (
                <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {duration}</span>
              )}
            </span>
          </div>

          {form.party && (
            <div className="summary-row">
              <span className="summary-key">Party</span>
              <span className="summary-val">{form.party}</span>
            </div>
          )}

          {form.transportMode && (
            <div className="summary-row">
              <span className="summary-key">Getting there</span>
              <span className="summary-val" style={{ textTransform: 'capitalize' }}>
                {form.transportMode}
              </span>
            </div>
          )}

          {form.travelStyle && (
            <div className="summary-row">
              <span className="summary-key">Style</span>
              <span className="summary-val">{form.travelStyle}</span>
            </div>
          )}

          {form.budget && (
            <div className="summary-row">
              <span className="summary-key">Budget</span>
              <span className="summary-val">
                ${parseInt(form.budget).toLocaleString()} USD
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main wizard component ────────────────────────────────────────────────────

export default function TripForm() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<WizardData>(EMPTY)
  const [serverErrors, setServerErrors] = useState<CreateTripResult & { success: false } | null>(
    null
  )
  const [isPending, startTransition] = useTransition()

  // Step 1 can advance when destination + party + valid date range are set
  const canAdvance1 =
    form.destination !== '' &&
    form.party !== '' &&
    form.startDate !== '' &&
    form.endDate !== '' &&
    new Date(form.endDate) > new Date(form.startDate)

  // Step 2 can advance when transport mode and travel style are both chosen
  const canAdvance2 = form.transportMode !== '' && form.travelStyle !== ''

  // Step 3 can submit when at least one activity is selected
  const canSubmit = form.activities.length > 0

  const canContinue =
    step === 1 ? canAdvance1 : step === 2 ? canAdvance2 : canSubmit

  function handleNext() {
    if (step < STEPS.length) setStep((s) => s + 1)
  }

  function handleBack() {
    if (step > 1) setStep((s) => s - 1)
  }

  function handleSubmit() {
    const formData = new FormData()
    formData.set('destination', form.destination)
    formData.set('startDate', form.startDate)
    formData.set('endDate', form.endDate)
    formData.set('travelMode', form.party) // party maps to travelMode
    formData.set('transportMode', form.transportMode)
    formData.set('budget', form.budget || '1000') // default $1,000 if not set
    formData.set('travelStyle', form.travelStyle)
    for (const a of form.activities) {
      formData.append('activityPreferences', a)
    }

    startTransition(async () => {
      const result = await createTripAction(formData)
      // createTripAction redirects on success — if we get a result, it has errors
      if (result && !result.success) {
        setServerErrors(result)
        // Surface field errors on the relevant step
        const e = result.errors
        if (e.destination || e.startDate || e.endDate || e.travelMode) {
          setStep(1)
        } else if (e.budget || e.travelStyle || e.transportMode) {
          setStep(2)
        }
      }
    })
  }

  const errors = serverErrors?.errors

  return (
    <div className="wizard-shell">
      {/* Header */}
      <header className="wizard-header">
        {step > 1 ? (
          <button
            className="wizard-back-btn"
            onClick={handleBack}
            aria-label="Back to previous step"
          >
            <IconArrowLeft />
          </button>
        ) : (
          <div style={{ width: 36 }} />
        )}

        <div className="step-counter" aria-label={`Step ${step} of ${STEPS.length}`}>
          <span className="step-counter-current">{step}</span>
          <span className="step-counter-sep" aria-hidden="true">
            of
          </span>
          <span className="step-counter-total">{STEPS.length}</span>
        </div>

        <div style={{ width: 36 }} />
      </header>

      {/* Progress bar */}
      <div
        className="wizard-progress-track"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-label="Form progress"
      >
        <div
          className="wizard-progress-fill"
          style={{ width: `${(step / STEPS.length) * 100}%` }}
        />
      </div>

      {/* Step content */}
      <main className="wizard-step-content">
        <div className="wizard-step-heading">
          <p className="wizard-step-eyebrow">Step {step}</p>
          <h1 className="wizard-step-title">{STEPS[step - 1].label}</h1>
        </div>

        {step === 1 && (
          <Step1 form={form} setForm={setForm} errors={errors} />
        )}
        {step === 2 && (
          <Step2 form={form} setForm={setForm} errors={errors} />
        )}
        {step === 3 && (
          <Step3 form={form} setForm={setForm} errors={errors} />
        )}
      </main>

      {/* Sticky footer */}
      <footer className="wizard-footer">
        <button
          className="wizard-btn-primary"
          disabled={!canContinue || isPending}
          aria-disabled={!canContinue || isPending}
          onClick={step < STEPS.length ? handleNext : handleSubmit}
        >
          {isPending
            ? 'Creating trip…'
            : step < STEPS.length
            ? 'Continue'
            : 'Generate travel advice'}
        </button>
      </footer>
    </div>
  )
}
