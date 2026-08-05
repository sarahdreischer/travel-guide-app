import { useState, useRef, useEffect } from 'react'

// ─── Data ────────────────────────────────────────────────────────────────────

const DESTINATIONS = [
  'Argentina', 'Australia', 'Bali, Indonesia', 'Barcelona, Spain',
  'Cambodia', 'Canada', 'Chile', 'Colombia', 'Costa Rica', 'Croatia',
  'Cuba', 'Egypt', 'France', 'Georgia', 'Greece', 'Iceland', 'India',
  'Italy', 'Japan', 'Jordan', 'Kenya', 'Laos', 'Malaysia', 'Mexico',
  'Morocco', 'Nepal', 'New Zealand', 'Norway', 'Peru', 'Philippines',
  'Portugal', 'Scotland', 'South Africa', 'Spain', 'Sri Lanka',
  'Switzerland', 'Thailand', 'Turkey', 'Vietnam',
]

const TRAVEL_MODES = [
  {
    id: 'fly', label: 'Fly',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19 4c-1 0-2 .5-2.5 1L13 8.8 4.8 6.2l-1.9 1.9L8 12l-3 3H3l-1 1.5L5 18l1.5 2L8 19l1-1v-2l3-3 3.2 4.2 1.9-1.9z" />
      </svg>
    ),
  },
  {
    id: 'drive', label: 'Drive',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-4h10l2 4h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2" />
        <circle cx="7.5" cy="17.5" r="2.5" />
        <circle cx="16.5" cy="17.5" r="2.5" />
      </svg>
    ),
  },
  {
    id: 'rail', label: 'Rail',
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
    id: 'sail', label: 'Sail',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 17h18M12 3v14M12 3C7 7 5 13 5 17h7M12 3c5 4 7 10 7 14h-7" />
      </svg>
    ),
  },
]

const PARTY_OPTIONS = ['Solo', 'Couple', 'Friends', 'Family']

const TRAVEL_STYLES = ['Adventure', 'Relaxed', 'Cultural', 'Luxury', 'Budget', 'Family']

const ACTIVITIES = [
  'Hiking', 'Swimming', 'Surfing', 'Cycling', 'Snorkelling',
  'Rock climbing', 'Yoga', 'Museums', 'Food tours', 'Nightlife',
  'Photography', 'Wildlife', 'Sailing', 'Skiing',
]

const STEPS = [
  { label: 'Where & When' },
  { label: 'Your trip' },
  { label: 'Interests' },
]

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
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function IconArrowLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  )
}

function IconGlobe() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function IconUser() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormData {
  destination: string
  startDate: string
  endDate: string
  party: string
  travelMode: string
  budget: string
  travelStyle: string[]
  activities: string[]
}

const EMPTY: FormData = {
  destination: '',
  startDate: '',
  endDate: '',
  party: '',
  travelMode: '',
  budget: '',
  travelStyle: [],
  activities: [],
}

// ─── Steps ───────────────────────────────────────────────────────────────────

function Step1({
  form, setForm,
}: {
  form: FormData
  setForm: React.Dispatch<React.SetStateAction<FormData>>
}) {
  const [query, setQuery] = useState(form.destination)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const filtered = query.length > 0
    ? DESTINATIONS.filter(d => d.toLowerCase().includes(query.toLowerCase())).slice(0, 7)
    : []

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

  return (
    <div className="form-stack">
      {/* Destination */}
      <div className="field-block">
        <label className="field-label" htmlFor="dest-input">Destination</label>
        <div className="dest-wrapper" ref={wrapRef}>
          <input
            id="dest-input"
            type="text"
            className="field-input"
            placeholder="Country or city"
            autoComplete="off"
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setForm(f => ({ ...f, destination: '' }))
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            aria-autocomplete="list"
            aria-expanded={open && filtered.length > 0}
          />
          {open && filtered.length > 0 && (
            <ul className="dest-dropdown" role="listbox" aria-label="Destinations">
              {filtered.map(d => (
                <li
                  key={d}
                  className="dest-item"
                  role="option"
                  aria-selected={form.destination === d}
                  onMouseDown={() => {
                    setForm(f => ({ ...f, destination: d }))
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
      </div>

      {/* Party */}
      <div className="field-block">
        <label className="field-label">Travelling as</label>
        <div className="chip-group" role="group" aria-label="Travel party">
          {PARTY_OPTIONS.map(p => (
            <button
              key={p}
              type="button"
              className={`chip ${form.party === p ? 'chip-on' : 'chip-idle'}`}
              aria-pressed={form.party === p}
              onClick={() => setForm(f => ({ ...f, party: p }))}
            >
              {p}
            </button>
          ))}
        </div>
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
            onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
          />
          <span className="date-row-sep" aria-hidden="true">→</span>
          <input
            type="date"
            className="field-input"
            aria-label="End date"
            value={form.endDate}
            min={form.startDate || undefined}
            onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
          />
        </div>
        {duration && (
          <p className="duration-tag" aria-live="polite">{duration}</p>
        )}
      </div>
    </div>
  )
}

function Step2({
  form, setForm,
}: {
  form: FormData
  setForm: React.Dispatch<React.SetStateAction<FormData>>
}) {
  const toggleStyle = (s: string) => {
    setForm(f => ({
      ...f,
      travelStyle: f.travelStyle.includes(s)
        ? f.travelStyle.filter(x => x !== s)
        : [...f.travelStyle, s],
    }))
  }

  return (
    <div className="form-stack">
      {/* Travel mode */}
      <div className="field-block">
        <label className="field-label">Primary travel mode</label>
        <div className="mode-grid" role="group" aria-label="Travel mode">
          {TRAVEL_MODES.map(m => (
            <button
              key={m.id}
              type="button"
              className={`mode-btn ${form.travelMode === m.id ? 'mode-btn-on' : 'mode-btn-idle'}`}
              aria-pressed={form.travelMode === m.id}
              onClick={() => setForm(f => ({ ...f, travelMode: m.id }))}
            >
              {m.icon}
              <span className="mode-label">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Budget */}
      <div className="field-block">
        <label className="field-label" htmlFor="budget-input">
          Approximate budget
          <span className="field-label-note">— optional</span>
        </label>
        <div className="budget-wrapper">
          <span className="budget-prefix" aria-hidden="true">$</span>
          <input
            id="budget-input"
            type="text"
            inputMode="numeric"
            className="field-input budget-input"
            placeholder="0"
            value={form.budget}
            onChange={e => setForm(f => ({ ...f, budget: e.target.value.replace(/\D/g, '') }))}
          />
          <span className="budget-suffix" aria-hidden="true">USD</span>
        </div>
        <p className="field-hint">Used to tailor cost advice and recommendations.</p>
      </div>

      {/* Travel style */}
      <div className="field-block">
        <label className="field-label">
          Travel style
          <span className="field-label-note">— select all that apply</span>
        </label>
        <div className="chip-group" role="group" aria-label="Travel style">
          {TRAVEL_STYLES.map(s => (
            <button
              key={s}
              type="button"
              className={`chip ${form.travelStyle.includes(s) ? 'chip-on' : 'chip-idle'}`}
              aria-pressed={form.travelStyle.includes(s)}
              onClick={() => toggleStyle(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Step3({
  form, setForm,
}: {
  form: FormData
  setForm: React.Dispatch<React.SetStateAction<FormData>>
}) {
  const toggleActivity = (a: string) => {
    setForm(f => ({
      ...f,
      activities: f.activities.includes(a)
        ? f.activities.filter(x => x !== a)
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
        <div className="chip-group" role="group" aria-label="Activity preferences">
          {ACTIVITIES.map(a => (
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

          {form.travelMode && (
            <div className="summary-row">
              <span className="summary-key">Mode</span>
              <span className="summary-val" style={{ textTransform: 'capitalize' }}>
                {form.travelMode}
              </span>
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

          {form.travelStyle.length > 0 && (
            <div className="summary-row">
              <span className="summary-key">Style</span>
              <span className="summary-val">{form.travelStyle.join(', ')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>(EMPTY)
  const [submitted, setSubmitted] = useState(false)

  const canAdvance1 =
    form.destination !== '' &&
    form.party !== '' &&
    form.startDate !== '' &&
    form.endDate !== '' &&
    new Date(form.endDate) > new Date(form.startDate)

  const canAdvance2 =
    form.travelMode !== '' &&
    form.travelStyle.length > 0

  const canSubmit = form.activities.length > 0

  function handleNext() {
    if (step < STEPS.length) setStep(s => s + 1)
  }

  function handleBack() {
    if (step > 1) setStep(s => s - 1)
  }

  function handleSubmit() {
    setSubmitted(true)
  }

  const canContinue = step === 1 ? canAdvance1 : step === 2 ? canAdvance2 : canSubmit

  if (submitted) {
    return (
      <div className="app-shell" style={{ justifyContent: 'center', alignItems: 'center', gap: 12 }}>
        <p style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          fontWeight: 600,
          fontSize: 22,
          letterSpacing: '-0.02em',
          color: 'var(--ink)',
          textAlign: 'center',
          padding: '0 32px',
          lineHeight: 1.3,
        }}>
          Generating advice for {form.destination}…
        </p>
        <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
          This usually takes a few seconds.
        </p>
      </div>
    )
  }

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        {step > 1 ? (
          <button
            className="back-btn"
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
          <span className="step-counter-sep" aria-hidden="true">of</span>
          <span className="step-counter-total">{STEPS.length}</span>
        </div>

        <div style={{ width: 36 }} />
      </header>

      {/* Progress */}
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-label="Form progress"
      >
        <div
          className="progress-fill"
          style={{ width: `${(step / STEPS.length) * 100}%` }}
        />
      </div>

      {/* Step content */}
      <main className="step-content">
        <div className="step-heading">
          <p className="step-eyebrow">Step {step}</p>
          <h1 className="step-title">{STEPS[step - 1].label}</h1>
        </div>

        {step === 1 && <Step1 form={form} setForm={setForm} />}
        {step === 2 && <Step2 form={form} setForm={setForm} />}
        {step === 3 && <Step3 form={form} setForm={setForm} />}
      </main>

      {/* Footer */}
      <footer className="step-footer">
        <button
          className="btn-primary"
          disabled={!canContinue}
          onClick={step < STEPS.length ? handleNext : handleSubmit}
          aria-disabled={!canContinue}
        >
          {step < STEPS.length ? 'Continue' : 'Generate travel advice'}
        </button>
      </footer>

      {/* Bottom nav */}
      <nav className="bottom-nav" aria-label="Main navigation">
        <button className="nav-item" aria-label="Destinations">
          <IconGlobe />
          Destinations
        </button>
        <button className="nav-item nav-item-active" aria-current="page" aria-label="New trip">
          <IconPlus />
          New trip
        </button>
        <button className="nav-item" aria-label="Profile">
          <IconUser />
          Profile
        </button>
      </nav>
    </div>
  )
}
