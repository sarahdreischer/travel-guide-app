import { useState, useRef, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Trip {
  id: string
  destination: string
  startDate: string
  endDate: string
  party: string
  travelMode: string
  budget: string
  travelStyle: string[]
  activities: string[]
}

interface AdviceItem {
  question: string
  answer: string
}

interface AdviceCategory {
  id: string
  name: string
  keyTip: string
  items: AdviceItem[]
}

type Screen =
  | { view: 'destinations' }
  | { view: 'new-trip' }
  | { view: 'trip-overview'; tripId: string }
  | { view: 'trip-category'; tripId: string; categoryId: string }
  | { view: 'profile' }

// ─── Advice data ──────────────────────────────────────────────────────────────

const ADVICE: Record<string, AdviceCategory[]> = {
  'Costa Rica': [
    {
      id: 'transport',
      name: 'Getting around',
      keyTip: 'A rental car is strongly recommended — get a 4x4 for remote areas.',
      items: [
        { question: 'Is driving recommended?', answer: 'Yes. Most tourist areas are accessible by car and having your own wheels lets you visit national parks on your own schedule.' },
        { question: 'What vehicle type is best?', answer: 'A 4x4 is advisable if you plan to visit beach towns, mountain areas, or national parks. Some roads become rough or flooded during wet season.' },
        { question: 'How much does car rental cost?', answer: '$50–100 per day including basic insurance. Alamo, Budget, and National all have desks at San José airport — compare rates before arriving.' },
        { question: 'Is public transport usable?', answer: 'Buses connect major towns affordably but are infrequent and don\'t serve most national parks. Useful for city travel; limiting for independent touring.' },
        { question: 'Should I book airport transfer in advance?', answer: 'Yes, especially for late arrivals. Shared shuttles cost $30–60 and are far safer than unofficial taxis soliciting outside the terminal.' },
        { question: 'Are mountain roads difficult?', answer: 'Some roads to highland areas are steep, narrow, and winding. Drive cautiously and avoid them after heavy rain.' },
      ],
    },
    {
      id: 'money',
      name: 'Money',
      keyTip: 'USD is accepted almost everywhere. Carry cash for rural areas and local sodas.',
      items: [
        { question: 'Do I need local currency?', answer: 'The colón is official but USD is accepted at most hotels, restaurants, and tourist businesses. You\'ll need colónes for buses, local sodas, and market stalls.' },
        { question: 'Is tipping expected?', answer: 'Yes — 10–15% at restaurants is customary. Many bills already include a 10% service charge; check before adding more.' },
        { question: 'Are ATMs reliable?', answer: 'Widely available in tourist areas and cities. Notify your bank before travelling. Use ATMs inside banks or supermarkets to avoid skimmers.' },
        { question: 'Are cards widely accepted?', answer: 'Credit cards work at hotels, larger restaurants, and shops. Smaller towns and rural areas are often cash-only — carry a buffer.' },
      ],
    },
    {
      id: 'safety',
      name: 'Health & safety',
      keyTip: 'Generally safe for solo travel. Pack DEET repellent — mosquitos are prevalent.',
      items: [
        { question: 'Is it safe for solo travel?', answer: 'Yes — one of Central America\'s safest destinations. Petty theft exists in tourist areas; keep valuables secure and avoid displaying expensive gear.' },
        { question: 'Are mosquitos a concern?', answer: 'Yes — dengue fever is present. Use DEET-based repellent, wear long sleeves at dawn and dusk, and use a net if your accommodation lacks window screens.' },
        { question: 'Is tap water safe?', answer: 'Safe in most cities and established tourist areas. In rural or remote areas, stick to bottled water.' },
        { question: 'Are vaccinations required?', answer: 'No mandatory vaccinations for most nationalities. Hepatitis A and typhoid are commonly recommended — consult a travel clinic 4–6 weeks before departure.' },
        { question: 'Is driving at night safe?', answer: 'Avoid it where possible. Road markings are poor, livestock roam highways, and potholes aren\'t visible. Aim to arrive before sunset.' },
      ],
    },
    {
      id: 'weather',
      name: 'Weather & packing',
      keyTip: 'August is wet season — expect heavy afternoon rain. Mornings are usually clear.',
      items: [
        { question: 'What is the weather like in August?', answer: 'Peak wet season. The Pacific coast gets heavy afternoon showers; the Caribbean coast is wetter year-round. Mornings are generally sunny and warm.' },
        { question: 'Does rain affect activities?', answer: 'Rain is typically short and intense rather than all-day. Most outdoor activities continue — wildlife is more active post-rain and crowds are lower.' },
        { question: 'What should I pack?', answer: 'A lightweight waterproof jacket, quick-dry clothing, and waterproof bags for electronics. Humidity is high — natural fibres are more comfortable than synthetics.' },
        { question: 'Do I need sun protection?', answer: 'Yes. UV levels are high year-round, even through cloud cover. SPF 50+, a hat, and UV-protective clothing are worthwhile.' },
      ],
    },
    {
      id: 'food',
      name: 'Food & drink',
      keyTip: 'Eat at sodas — small local restaurants serving casados for $5–10.',
      items: [
        { question: 'What is a soda?', answer: 'A family-run Costa Rican restaurant serving traditional casados: rice, beans, a protein, salad, and fried plantain. Expect to pay $5–10 for a full meal.' },
        { question: 'What dishes should I try?', answer: 'Gallo pinto (rice and black beans), ceviche, patacones (fried green plantain), and fresh tropical fruit. The casado is the standard lunch plate.' },
        { question: 'Is vegetarian food available?', answer: 'Yes — rice and beans are a staple and naturally plant-based. Larger towns have dedicated vegetarian options; rural areas are more limited.' },
        { question: 'Is street food safe?', answer: 'Generally yes in populated areas. Busy stalls with high turnover are typically safer — use the same judgement you would anywhere.' },
      ],
    },
    {
      id: 'connectivity',
      name: 'Connectivity',
      keyTip: 'Mobile data is reliable in towns. Remote parks can be fully off-grid.',
      items: [
        { question: 'Should I get a local SIM?', answer: 'Yes — Kolbi and Claro sell affordable tourist SIMs at the airport and convenience stores. Expect $15–25 for a week of data.' },
        { question: 'Is WiFi available?', answer: 'Most hotels, hostels, and cafés offer WiFi. Quality varies. A local SIM is more reliable for navigation and maps when exploring.' },
        { question: 'Will my phone work there?', answer: 'Most modern unlocked phones work on Costa Rican networks. Check international roaming costs with your carrier before relying on your home plan.' },
      ],
    },
    {
      id: 'local',
      name: 'Local life',
      keyTip: '"Pura vida" is the national motto — embrace a slower pace and greet everyone warmly.',
      items: [
        { question: 'What does "Pura vida" mean?', answer: '"Pure life" — used as a greeting, farewell, and expression of contentment. Using it with locals signals you\'re in the spirit of the place.' },
        { question: 'What customs should I know?', answer: 'Greet with a handshake or cheek kiss. Addressing strangers formally (usted rather than tú) is polite. Punctuality is relaxed — "Tico time" is a real phenomenon.' },
        { question: 'Are laundry facilities available?', answer: 'Self-service laundromats are available in cities and most tourist towns. Many hostels and hotels offer laundry service for a small fee.' },
        { question: 'Anything else I should know?', answer: 'Pack for varying weather — it can rain unexpectedly even in the dry season at altitude. Most national parks now require advance booking; plan ahead.' },
      ],
    },
  ],
}

function getAdvice(destination: string): AdviceCategory[] {
  return ADVICE[destination] ?? ADVICE['Costa Rica']
}

// ─── Sample trips ──────────────────────────────────────────────────────────────

const SAMPLE_TRIPS: Trip[] = [
  {
    id: '1',
    destination: 'Costa Rica',
    startDate: '2026-08-14',
    endDate: '2026-08-21',
    party: 'Solo',
    travelMode: 'fly',
    budget: '3000',
    travelStyle: ['Adventure'],
    activities: ['Hiking', 'Surfing', 'Wildlife'],
  },
  {
    id: '2',
    destination: 'Japan',
    startDate: '2026-03-28',
    endDate: '2026-04-11',
    party: 'Couple',
    travelMode: 'fly',
    budget: '6000',
    travelStyle: ['Cultural', 'Relaxed'],
    activities: ['Museums', 'Food tours', 'Photography'],
  },
]

// ─── Form data ────────────────────────────────────────────────────────────────

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

// ─── Utilities ────────────────────────────────────────────────────────────────

function getDuration(start: string, end: string): string {
  if (!start || !end) return ''
  const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000)
  if (diff <= 0) return ''
  return `${diff} night${diff !== 1 ? 's' : ''}`
}

function fmtDate(iso: string): string {
  if (!iso) return ''
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function fmtDateShort(iso: string): string {
  if (!iso) return ''
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short',
  })
}

function relativeTime(startIso: string, endIso: string): string {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const start = new Date(startIso + 'T00:00:00')
  const end = new Date(endIso + 'T00:00:00')
  const daysToStart = Math.round((start.getTime() - now.getTime()) / 86400000)
  const daysToEnd = Math.round((end.getTime() - now.getTime()) / 86400000)

  if (daysToStart > 0) {
    if (daysToStart === 1) return 'Tomorrow'
    if (daysToStart < 7) return `In ${daysToStart} days`
    if (daysToStart < 30) return `In ${Math.round(daysToStart / 7)} weeks`
    if (daysToStart < 365) return `In ${Math.round(daysToStart / 30)} months`
    return `In ${Math.round(daysToStart / 365)} year${daysToStart > 500 ? 's' : ''}`
  }
  if (daysToEnd >= 0) return 'In progress'
  const ago = Math.abs(daysToEnd)
  if (ago < 7) return `${ago} days ago`
  if (ago < 30) return `${Math.round(ago / 7)} weeks ago`
  if (ago < 365) return `${Math.round(ago / 30)} months ago`
  return `${Math.round(ago / 365)} year${ago > 500 ? 's' : ''} ago`
}

function isUpcoming(endIso: string): boolean {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  return new Date(endIso + 'T00:00:00') >= now
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconArrowLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  )
}

function IconPlus({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function IconGlobe() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function IconUser() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function IconChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function IconChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

// ─── Destinations screen ──────────────────────────────────────────────────────

function DestinationsScreen({
  trips,
  onAddTrip,
  onOpenTrip,
}: {
  trips: Trip[]
  onAddTrip: () => void
  onOpenTrip: (id: string) => void
}) {
  const upcoming = trips.filter(t => isUpcoming(t.endDate))
  const past = trips.filter(t => !isUpcoming(t.endDate))

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Trips</h1>
        <button className="page-header-add" onClick={onAddTrip} aria-label="Add a trip">
          <IconPlus size={15} />
        </button>
      </header>

      <div className="page-body">
        <span className="section-label">Upcoming</span>

        {upcoming.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">
              No trips planned yet. Add your first destination to get personalised travel advice.
            </p>
            <button className="empty-state-btn" onClick={onAddTrip}>
              <IconPlus size={13} />
              Plan a trip
            </button>
          </div>
        ) : (
          <div className="trip-list">
            {upcoming.map(trip => (
              <TripRow key={trip.id} trip={trip} onClick={() => onOpenTrip(trip.id)} />
            ))}
          </div>
        )}

        {past.length > 0 && (
          <>
            <span className="section-label" style={{ marginTop: 24, display: 'block' }}>Past</span>
            <div className="trip-list">
              {past.map(trip => (
                <TripRow key={trip.id} trip={trip} onClick={() => onOpenTrip(trip.id)} />
              ))}
            </div>
          </>
        )}

        <div style={{ height: 32 }} />
      </div>
    </>
  )
}

function TripRow({ trip, onClick }: { trip: Trip; onClick: () => void }) {
  const past = !isUpcoming(trip.endDate)
  const duration = getDuration(trip.startDate, trip.endDate)
  const relative = relativeTime(trip.startDate, trip.endDate)

  const meta = [
    `${fmtDateShort(trip.startDate)} – ${fmtDate(trip.endDate)}`,
    duration,
    trip.party,
    ...trip.travelStyle,
  ].filter(Boolean).join('  ·  ')

  return (
    <button
      className={`trip-row${past ? ' is-past' : ''}`}
      onClick={onClick}
      aria-label={`${trip.destination}, ${meta}`}
    >
      <div className="trip-row-top">
        <span className="trip-row-destination">{trip.destination}</span>
        <span className={`trip-row-time${!past ? ' is-soon' : ''}`}>{relative}</span>
      </div>
      <p className="trip-row-meta">{meta}</p>
      <span className="trip-row-chevron" aria-hidden="true">
        <IconChevronRight />
      </span>
    </button>
  )
}

// ─── Category icons ───────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, React.ReactElement> = {
  transport: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-4h10l2 4h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/>
    </svg>
  ),
  money: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/><path d="M12 6v12M9 9a3 3 0 0 1 6 0c0 1.5-1.5 2-3 3s-3 1.5-3 3a3 3 0 0 0 6 0"/>
    </svg>
  ),
  safety: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  weather: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
    </svg>
  ),
  food: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
    </svg>
  ),
  connectivity: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/>
    </svg>
  ),
  local: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
}

// ─── Trip overview screen ─────────────────────────────────────────────────────

function TripOverviewScreen({
  trip,
  onBack,
  onOpenCategory,
}: {
  trip: Trip
  onBack: () => void
  onOpenCategory: (categoryId: string) => void
}) {
  const categories = getAdvice(trip.destination)
  const duration = getDuration(trip.startDate, trip.endDate)

  const detail = [
    `${fmtDateShort(trip.startDate)} – ${fmtDate(trip.endDate)}`,
    duration,
    trip.party,
    ...trip.travelStyle,
  ].filter(Boolean).join('  ·  ')

  return (
    <>
      <header className="page-header">
        <button className="page-header-btn" onClick={onBack} aria-label="Back to trips">
          <IconArrowLeft />
        </button>
        <span className="page-title" style={{ fontSize: 15 }}>Travel advice</span>
        <div style={{ width: 36 }} />
      </header>

      <div className="page-body">
        <div className="trip-overview-meta">
          <p className="trip-overview-destination">{trip.destination}</p>
          <p className="trip-overview-detail">{detail}</p>
        </div>

        <div className="category-list">
          {categories.map((cat, i) => (
            <button
              key={cat.id}
              className="category-row"
              onClick={() => onOpenCategory(cat.id)}
              aria-label={cat.name}
            >
              <span className="category-row-num">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="category-row-body">
                <p className="category-row-name">{cat.name}</p>
                <p className="category-row-tip">{cat.keyTip}</p>
              </div>
              <span className="category-row-chevron" aria-hidden="true">
                <IconChevronRight />
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

// ─── Category detail screen ───────────────────────────────────────────────────

function CategoryDetailScreen({
  trip,
  categoryId,
  onBack,
}: {
  trip: Trip
  categoryId: string
  onBack: () => void
}) {
  const categories = getAdvice(trip.destination)
  const cat = categories.find(c => c.id === categoryId)
  if (!cat) return null

  return (
    <>
      <header className="page-header">
        <button className="page-header-btn" onClick={onBack} aria-label={`Back to ${trip.destination}`}>
          <IconArrowLeft />
        </button>
        <span className="page-title" style={{ fontSize: 15 }}>{trip.destination}</span>
        <div style={{ width: 36 }} />
      </header>

      <div className="category-detail-body">
        <div className="category-lead">
          <p className="category-lead-label">{cat.name}</p>
          <p className="category-lead-tip">{cat.keyTip}</p>
        </div>

        <div className="category-qa-list">
          {cat.items.map((item, i) => (
            <div key={i} className="category-qa-item">
              <p className="category-qa-q">{item.question}</p>
              <p className="category-qa-a">{item.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ─── Add trip form ────────────────────────────────────────────────────────────

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

const EMPTY_FORM: FormData = {
  destination: '',
  startDate: '',
  endDate: '',
  party: '',
  travelMode: '',
  budget: '',
  travelStyle: [],
  activities: [],
}

function Step1({ form, setForm }: { form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>> }) {
  const [query, setQuery] = useState(form.destination)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const filtered = query.length > 0
    ? DESTINATIONS.filter(d => d.toLowerCase().includes(query.toLowerCase())).slice(0, 7)
    : []

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [])

  const duration = getDuration(form.startDate, form.endDate)

  return (
    <div className="form-stack">
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
            onChange={e => { setQuery(e.target.value); setForm(f => ({ ...f, destination: '' })); setOpen(true) }}
            onFocus={() => setOpen(true)}
            aria-autocomplete="list"
            aria-expanded={open && filtered.length > 0}
          />
          {open && filtered.length > 0 && (
            <ul className="dest-dropdown" role="listbox">
              {filtered.map(d => (
                <li key={d} className="dest-item" role="option" aria-selected={form.destination === d}
                  onMouseDown={() => { setForm(f => ({ ...f, destination: d })); setQuery(d); setOpen(false) }}>
                  {d}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="field-block">
        <label className="field-label">Travelling as</label>
        <div className="chip-group" role="group">
          {PARTY_OPTIONS.map(p => (
            <button key={p} type="button" className={`chip ${form.party === p ? 'chip-on' : 'chip-idle'}`}
              aria-pressed={form.party === p} onClick={() => setForm(f => ({ ...f, party: p }))}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="field-block">
        <label className="field-label">Travel dates</label>
        <div className="date-row">
          <input type="date" className="field-input" aria-label="Start date" value={form.startDate}
            onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
          <span className="date-row-sep" aria-hidden="true">→</span>
          <input type="date" className="field-input" aria-label="End date" value={form.endDate}
            min={form.startDate || undefined} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
        </div>
        {duration && <p className="duration-tag" aria-live="polite">{duration}</p>}
      </div>
    </div>
  )
}

function Step2({ form, setForm }: { form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>> }) {
  const toggleStyle = (s: string) => setForm(f => ({
    ...f,
    travelStyle: f.travelStyle.includes(s) ? f.travelStyle.filter(x => x !== s) : [...f.travelStyle, s],
  }))

  return (
    <div className="form-stack">
      <div className="field-block">
        <label className="field-label">Primary travel mode</label>
        <div className="mode-grid" role="group">
          {TRAVEL_MODES.map(m => (
            <button key={m.id} type="button"
              className={`mode-btn ${form.travelMode === m.id ? 'mode-btn-on' : 'mode-btn-idle'}`}
              aria-pressed={form.travelMode === m.id} onClick={() => setForm(f => ({ ...f, travelMode: m.id }))}>
              {m.icon}
              <span className="mode-label">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field-block">
        <label className="field-label" htmlFor="budget-input">
          Approximate budget <span className="field-label-note">— optional</span>
        </label>
        <div className="budget-wrapper">
          <span className="budget-prefix" aria-hidden="true">$</span>
          <input id="budget-input" type="text" inputMode="numeric" className="field-input budget-input"
            placeholder="0" value={form.budget}
            onChange={e => setForm(f => ({ ...f, budget: e.target.value.replace(/\D/g, '') }))} />
          <span className="budget-suffix" aria-hidden="true">USD</span>
        </div>
        <p className="field-hint">Used to tailor cost advice and recommendations.</p>
      </div>

      <div className="field-block">
        <label className="field-label">Travel style <span className="field-label-note">— select all that apply</span></label>
        <div className="chip-group" role="group">
          {TRAVEL_STYLES.map(s => (
            <button key={s} type="button" className={`chip ${form.travelStyle.includes(s) ? 'chip-on' : 'chip-idle'}`}
              aria-pressed={form.travelStyle.includes(s)} onClick={() => toggleStyle(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Step3({ form, setForm }: { form: FormData; setForm: React.Dispatch<React.SetStateAction<FormData>> }) {
  const toggleActivity = (a: string) => setForm(f => ({
    ...f,
    activities: f.activities.includes(a) ? f.activities.filter(x => x !== a) : [...f.activities, a],
  }))

  const duration = getDuration(form.startDate, form.endDate)

  return (
    <div className="form-stack">
      <div className="field-block">
        <label className="field-label">Activity preferences <span className="field-label-note">— select at least one</span></label>
        <div className="chip-group" role="group">
          {ACTIVITIES.map(a => (
            <button key={a} type="button" className={`chip ${form.activities.includes(a) ? 'chip-on' : 'chip-idle'}`}
              aria-pressed={form.activities.includes(a)} onClick={() => toggleActivity(a)}>
              {a}
            </button>
          ))}
        </div>
      </div>

      {form.destination && (
        <div className="summary-panel" aria-label="Trip summary">
          <p className="summary-header">Trip summary</p>
          <div className="summary-row"><span className="summary-key">Destination</span><span className="summary-val">{form.destination}</span></div>
          <div className="summary-row">
            <span className="summary-key">Dates</span>
            <span className="summary-val">
              {fmtDate(form.startDate)} – {fmtDate(form.endDate)}
              {duration && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {duration}</span>}
            </span>
          </div>
          {form.party && <div className="summary-row"><span className="summary-key">Party</span><span className="summary-val">{form.party}</span></div>}
          {form.travelMode && <div className="summary-row"><span className="summary-key">Mode</span><span className="summary-val" style={{ textTransform: 'capitalize' }}>{form.travelMode}</span></div>}
          {form.budget && <div className="summary-row"><span className="summary-key">Budget</span><span className="summary-val">${parseInt(form.budget).toLocaleString()} USD</span></div>}
          {form.travelStyle.length > 0 && <div className="summary-row"><span className="summary-key">Style</span><span className="summary-val">{form.travelStyle.join(', ')}</span></div>}
        </div>
      )}
    </div>
  )
}

function NewTripScreen({
  onSubmit,
  onCancel,
}: {
  onSubmit: (form: FormData) => void
  onCancel: () => void
}) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)

  const canAdvance1 = form.destination !== '' && form.party !== '' && form.startDate !== '' &&
    form.endDate !== '' && new Date(form.endDate) > new Date(form.startDate)
  const canAdvance2 = form.travelMode !== '' && form.travelStyle.length > 0
  const canSubmit = form.activities.length > 0

  const canContinue = step === 1 ? canAdvance1 : step === 2 ? canAdvance2 : canSubmit

  return (
    <>
      <header className="app-header">
        {step > 1 ? (
          <button className="back-btn" onClick={() => setStep(s => s - 1)} aria-label="Previous step">
            <IconArrowLeft />
          </button>
        ) : (
          <button className="back-btn" onClick={onCancel} aria-label="Cancel">
            <IconArrowLeft />
          </button>
        )}
        <div className="step-counter" aria-label={`Step ${step} of ${STEPS.length}`}>
          <span className="step-counter-current">{step}</span>
          <span className="step-counter-sep" aria-hidden="true">of</span>
          <span className="step-counter-total">{STEPS.length}</span>
        </div>
        <div style={{ width: 36 }} />
      </header>

      <div className="progress-track" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={STEPS.length}>
        <div className="progress-fill" style={{ width: `${(step / STEPS.length) * 100}%` }} />
      </div>

      <main className="step-content">
        <div className="step-heading">
          <p className="step-eyebrow">Step {step}</p>
          <h1 className="step-title">{STEPS[step - 1].label}</h1>
        </div>
        {step === 1 && <Step1 form={form} setForm={setForm} />}
        {step === 2 && <Step2 form={form} setForm={setForm} />}
        {step === 3 && <Step3 form={form} setForm={setForm} />}
      </main>

      <footer className="step-footer">
        <button className="btn-primary" disabled={!canContinue}
          onClick={() => step < STEPS.length ? setStep(s => s + 1) : onSubmit(form)}>
          {step < STEPS.length ? 'Continue' : 'Generate travel advice'}
        </button>
      </footer>
    </>
  )
}

// ─── Bottom nav ───────────────────────────────────────────────────────────────

function BottomNav({
  active,
  onNavigate,
}: {
  active: 'destinations' | 'new-trip' | 'profile'
  onNavigate: (target: 'destinations' | 'new-trip' | 'profile') => void
}) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      <button className={`nav-item${active === 'destinations' ? ' nav-item-active' : ''}`}
        aria-current={active === 'destinations' ? 'page' : undefined}
        onClick={() => onNavigate('destinations')}>
        <IconGlobe />
        Trips
      </button>
      <button className={`nav-item${active === 'new-trip' ? ' nav-item-active' : ''}`}
        aria-current={active === 'new-trip' ? 'page' : undefined}
        onClick={() => onNavigate('new-trip')}>
        <IconPlus />
        New trip
      </button>
      <button className={`nav-item${active === 'profile' ? ' nav-item-active' : ''}`}
        aria-current={active === 'profile' ? 'page' : undefined}
        onClick={() => onNavigate('profile')}>
        <IconUser />
        Profile
      </button>
    </nav>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<Screen>({ view: 'destinations' })
  const [trips, setTrips] = useState<Trip[]>(SAMPLE_TRIPS)

  function handleAddTrip(form: FormData) {
    const newTrip: Trip = { ...form, id: generateId() }
    setTrips(prev => [newTrip, ...prev])
    setScreen({ view: 'trip-overview', tripId: newTrip.id })
  }

  function navActive(): 'destinations' | 'new-trip' | 'profile' {
    if (screen.view === 'new-trip') return 'new-trip'
    if (screen.view === 'profile') return 'profile'
    return 'destinations'
  }

  function handleNavNavigate(target: 'destinations' | 'new-trip' | 'profile') {
    if (target === 'new-trip') setScreen({ view: 'new-trip' })
    else if (target === 'profile') setScreen({ view: 'profile' })
    else setScreen({ view: 'destinations' })
  }

  const hideNav = false

  return (
    <div className="app-shell">
      {screen.view === 'destinations' && (
        <DestinationsScreen
          trips={trips}
          onAddTrip={() => setScreen({ view: 'new-trip' })}
          onOpenTrip={id => setScreen({ view: 'trip-overview', tripId: id })}
        />
      )}

      {screen.view === 'new-trip' && (
        <NewTripScreen
          onSubmit={handleAddTrip}
          onCancel={() => setScreen({ view: 'destinations' })}
        />
      )}

      {screen.view === 'trip-overview' && (() => {
        const trip = trips.find(t => t.id === screen.tripId)
        if (!trip) return null
        return (
          <TripOverviewScreen
            trip={trip}
            onBack={() => setScreen({ view: 'destinations' })}
            onOpenCategory={catId => setScreen({ view: 'trip-category', tripId: trip.id, categoryId: catId })}
          />
        )
      })()}

      {screen.view === 'trip-category' && (() => {
        const trip = trips.find(t => t.id === screen.tripId)
        if (!trip) return null
        return (
          <CategoryDetailScreen
            trip={trip}
            categoryId={screen.categoryId}
            onBack={() => setScreen({ view: 'trip-overview', tripId: trip.id })}
          />
        )
      })()}

      {screen.view === 'profile' && (
        <>
          <header className="page-header">
            <h1 className="page-title">Profile</h1>
            <div style={{ width: 36 }} />
          </header>
          <div className="page-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Profile settings coming soon.</p>
          </div>
        </>
      )}

      {!hideNav && (
        <BottomNav active={navActive()} onNavigate={handleNavNavigate} />
      )}
    </div>
  )
}
