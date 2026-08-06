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

interface DisplayGroup {
  id: string
  name: string
  keyTip: string
  sources: AdviceCategory[]
}

type Screen =
  | { view: 'login' }
  | { view: 'signup' }
  | { view: 'destinations' }
  | { view: 'new-trip' }
  | { view: 'trip-overview'; tripId: string }
  | { view: 'trip-category'; tripId: string; categoryId: string }
  | { view: 'profile' }

// ─── Advice data ──────────────────────────────────────────────────────────────

const ADVICE: Record<string, AdviceCategory[]> = {
  'Costa Rica': [
    {
      id: 'transport-self-driving',
      name: 'Transportation – Self Driving',
      keyTip: 'A rental car is strongly recommended — get a 4x4 for remote areas.',
      items: [
        { question: 'Is driving recommended?', answer: 'Yes. Most tourist areas are accessible by car and having your own wheels lets you visit national parks on your own schedule.' },
        { question: 'Are road conditions good?', answer: 'Main highways are paved and in reasonable condition. Secondary roads to beach towns and national parks can be rough, especially in wet season.' },
        { question: 'Are mountain roads difficult?', answer: 'Some roads to highland areas are steep, narrow, and winding. Drive cautiously and avoid them after heavy rain.' },
      ],
    },
    {
      id: 'transport-car-rental',
      name: 'Transportation - Car Rental',
      keyTip: 'Yes, a rental car is recommended for flexibility and exploring remote areas.',
      items: [
        { question: 'What type of vehicle is recommended?', answer: 'A 4x4 is advisable if you plan to visit beach towns, mountain areas, or national parks. Some roads become rough or flooded during wet season.' },
        { question: 'How much does car rental cost?', answer: '$50–100 per day including basic insurance. Alamo, Budget, and National all have desks at San José airport — compare rates before arriving.' },
        { question: 'Which providers are best?', answer: 'Alamo, Budget, and National are reputable. Book in advance during peak season. Read the insurance policy carefully — full coverage is worth it.' },
        { question: 'Are there age restrictions?', answer: 'Most providers require drivers to be 21+. Some charge a young driver surcharge for under-25s. Bring your home driving licence and an international permit if required.' },
      ],
    },
    {
      id: 'transport-parking',
      name: 'Transportation - Parking',
      keyTip: 'Parking can be easy in urban areas but may be limited in popular tourist spots.',
      items: [
        { question: 'Is parking easy to find?', answer: 'In cities, paid car parks are available and reasonably priced. At national parks and popular beaches, parking can fill up early — arrive before 8am.' },
        { question: 'Is it safe to leave valuables in a parked car?', answer: 'No — never leave bags, electronics, or passports visible in a parked car, even briefly. Theft from parked vehicles is common in tourist areas.' },
        { question: 'Are there parking fees?', answer: 'City car parks typically charge $1–3 per hour. Guarded lots (with an attendant) are safer and cost roughly the same.' },
      ],
    },
    {
      id: 'transport-public',
      name: 'Transportation – Public Transport',
      keyTip: 'Public transport is available but may not reach all tourist destinations.',
      items: [
        { question: 'Is public transport usable?', answer: 'Buses connect major towns affordably but are infrequent and don\'t serve most national parks. Useful for city travel; limiting for independent touring.' },
        { question: 'What bus companies are reliable?', answer: 'Tica Bus and TransNica for international routes; local Empresario companies for intercity travel. Tickets are cheap at $3–15 for most journeys.' },
        { question: 'Is there a metro or train?', answer: 'San José has a commuter rail line but it is limited. No metro. For city travel, local buses and taxis are the main options.' },
      ],
    },
    {
      id: 'transport-serviced',
      name: 'Transportation – Serviced',
      keyTip: 'Yes, booking airport transport in advance is advisable for convenience.',
      items: [
        { question: 'Should I book airport transfer in advance?', answer: 'Yes, especially for late arrivals. Shared shuttles cost $30–60 and are far safer than unofficial taxis soliciting outside the terminal.' },
        { question: 'Are taxis safe?', answer: 'Official red taxis with a yellow triangle and meter (mariachi) are safe and regulated. Avoid unmarked cars offering rides outside the terminal.' },
        { question: 'Is Uber available?', answer: 'Yes, Uber operates in San José and some tourist areas. Fares are comparable to taxis. The app works on local SIMs and international roaming.' },
      ],
    },
    {
      id: 'accommodation',
      name: 'Accommodation',
      keyTip: 'Book in advance for peak season — options range from hostels to eco-lodges.',
      items: [
        { question: 'When should I book accommodation?', answer: 'At least 4–6 weeks ahead for peak season (December–April) and national parks. Wet season (May–November) has more availability and lower prices.' },
        { question: 'What types of accommodation are available?', answer: 'Wide range — from $15 hostel dorms to eco-lodges in the rainforest to luxury beach resorts. Mid-range hotels cost $60–120 per night.' },
        { question: 'Are eco-lodges worth it?', answer: 'Yes if you want an immersive nature experience. Many are located inside or adjacent to national parks, with guides and wildlife on-site.' },
      ],
    },
    {
      id: 'money',
      name: 'Budget & Money',
      keyTip: 'Yes, it\'s advisable to bring some cash for small purchases.',
      items: [
        { question: 'Do I need local currency?', answer: 'The colón is official but USD is accepted at most hotels, restaurants, and tourist businesses. You\'ll need colónes for buses, local sodas, and market stalls.' },
        { question: 'Is tipping expected?', answer: 'Yes — 10–15% at restaurants is customary. Many bills already include a 10% service charge; check before adding more.' },
        { question: 'Are ATMs reliable?', answer: 'Widely available in tourist areas and cities. Notify your bank before travelling. Use ATMs inside banks or supermarkets to avoid skimmers.' },
        { question: 'Are cards widely accepted?', answer: 'Credit cards work at hotels, larger restaurants, and shops. Smaller towns and rural areas are often cash-only — carry a buffer.' },
      ],
    },
    {
      id: 'connectivity',
      name: 'Connectivity',
      keyTip: 'Mobile data is generally reliable in urban areas.',
      items: [
        { question: 'Should I get a local SIM?', answer: 'Yes — Kolbi and Claro sell affordable tourist SIMs at the airport and convenience stores. Expect $15–25 for a week of data.' },
        { question: 'Is WiFi available?', answer: 'Most hotels, hostels, and cafés offer WiFi. Quality varies. A local SIM is more reliable for navigation and maps when exploring.' },
        { question: 'Will my phone work there?', answer: 'Most modern unlocked phones work on Costa Rican networks. Check international roaming costs with your carrier before relying on your home plan.' },
      ],
    },
    {
      id: 'packing',
      name: 'Packing',
      keyTip: 'Yes, insect repellent is advisable, especially in rural areas.',
      items: [
        { question: 'What should I pack?', answer: 'A lightweight waterproof jacket, quick-dry clothing, and waterproof bags for electronics. Humidity is high — natural fibres are more comfortable than synthetics.' },
        { question: 'What health items are essential?', answer: 'DEET-based insect repellent, SPF 50+ sunscreen, a hat, and a basic first aid kit. Bring any prescription medications in original packaging.' },
        { question: 'Do I need special gear?', answer: 'Sturdy waterproof footwear is worth it for national parks. A dry bag protects electronics on river crossings and boat tours.' },
      ],
    },
    {
      id: 'food',
      name: 'Food',
      keyTip: 'Locals often eat at sodas (small restaurants) for authentic cuisine.',
      items: [
        { question: 'What is a soda?', answer: 'A family-run Costa Rican restaurant serving traditional casados: rice, beans, a protein, salad, and fried plantain. Expect to pay $5–10 for a full meal.' },
        { question: 'What dishes should I try?', answer: 'Gallo pinto (rice and black beans), ceviche, patacones (fried green plantain), and fresh tropical fruit. The casado is the standard lunch plate.' },
        { question: 'Is vegetarian food available?', answer: 'Yes — rice and beans are a staple and naturally plant-based. Larger towns have dedicated vegetarian options; rural areas are more limited.' },
        { question: 'Is street food safe?', answer: 'Generally yes in populated areas. Busy stalls with high turnover are typically safer — use the same judgement you would anywhere.' },
      ],
    },
    {
      id: 'laundry',
      name: 'Laundry',
      keyTip: 'Yes, self-service laundrettes are available in urban areas.',
      items: [
        { question: 'Are laundry facilities available?', answer: 'Self-service laundromats are available in cities and most tourist towns, typically charging $3–6 per load. Many hostels and hotels offer laundry service for a small fee.' },
        { question: 'How long does laundry take?', answer: 'Drop-off services at hotels usually take 24 hours. Self-service laundromats are faster — plan a rest day or morning in town.' },
      ],
    },
    {
      id: 'daily-logistics',
      name: 'Daily Logistics',
      keyTip: 'Tap to read',
      items: [
        { question: 'What are typical opening hours?', answer: 'Shops generally open 8am–7pm; supermarkets until 9pm. Government offices and banks close by 4pm. Many businesses close on Sunday.' },
        { question: 'Do I need to book national parks in advance?', answer: 'Yes — most parks have daily visitor caps. Book online via SINAC at least a week ahead. Arenal, Manuel Antonio, and Tortuguero fill quickly.' },
        { question: 'What voltage and plug type is used?', answer: 'Costa Rica uses 120V, 60Hz with type A/B plugs (same as the US). Most modern electronics are dual-voltage and will work without an adapter.' },
      ],
    },
    {
      id: 'activities',
      name: 'Activities',
      keyTip: 'Tap to read',
      items: [
        { question: 'What activities are available?', answer: 'Ziplining, white-water rafting, surfing, snorkelling, wildlife watching, and volcano hiking are all popular. The country is compact — you can pack a lot into one trip.' },
        { question: 'Do I need to book in advance?', answer: 'Popular tours (Arenal canopy, Manuel Antonio boat, Monteverde suspension bridges) book up quickly in high season. Reserve a week ahead minimum.' },
        { question: 'What\'s the best way to see wildlife?', answer: 'Hire a local guide — they spot animals that visitors walk straight past. Early morning (6–8am) is peak wildlife activity. A good pair of binoculars is worthwhile.' },
      ],
    },
    {
      id: 'weather',
      name: 'Weather',
      keyTip: 'Yes, rain showers are common in August due to the wet season.',
      items: [
        { question: 'What is the weather like in August?', answer: 'Peak wet season. The Pacific coast gets heavy afternoon showers; the Caribbean coast is wetter year-round. Mornings are generally sunny and warm.' },
        { question: 'Does rain affect activities?', answer: 'Rain is typically short and intense rather than all-day. Most outdoor activities continue — wildlife is more active post-rain and crowds are lower.' },
        { question: 'How hot is it?', answer: 'Coastal areas reach 28–33°C. The Central Valley (San José, Monteverde) is cooler at 18–24°C. Highland areas can drop to 10°C at night.' },
      ],
    },
    {
      id: 'safety',
      name: 'Safety',
      keyTip: 'Yes, Costa Rica is generally safe for solo travelers.',
      items: [
        { question: 'Is it safe for solo travel?', answer: 'Yes — one of Central America\'s safest destinations. Petty theft exists in tourist areas; keep valuables secure and avoid displaying expensive gear.' },
        { question: 'Are mosquitos a concern?', answer: 'Yes — dengue fever is present. Use DEET-based repellent, wear long sleeves at dawn and dusk, and use a net if your accommodation lacks window screens.' },
        { question: 'Is tap water safe?', answer: 'Safe in most cities and established tourist areas. In rural or remote areas, stick to bottled water.' },
        { question: 'Are vaccinations required?', answer: 'No mandatory vaccinations for most nationalities. Hepatitis A and typhoid are commonly recommended — consult a travel clinic 4–6 weeks before departure.' },
        { question: 'Is driving at night safe?', answer: 'Avoid it where possible. Road markings are poor, livestock roam highways, and potholes aren\'t visible. Aim to arrive before sunset.' },
      ],
    },
    {
      id: 'local-etiquette',
      name: 'Local Etiquette',
      keyTip: 'Tap to read',
      items: [
        { question: 'What does "Pura vida" mean?', answer: '"Pure life" — used as a greeting, farewell, and expression of contentment. Using it with locals signals you\'re in the spirit of the place.' },
        { question: 'What customs should I know?', answer: 'Greet with a handshake or cheek kiss. Addressing strangers formally (usted rather than tú) is polite. Punctuality is relaxed — "Tico time" is a real phenomenon.' },
        { question: 'What language do they speak?', answer: 'Spanish is the official language. English is widely spoken in tourist areas, hotels, and national parks, but learning a few Spanish phrases is appreciated.' },
      ],
    },
    {
      id: 'miscellaneous',
      name: 'Miscellaneous',
      keyTip: 'Tap to read',
      items: [
        { question: 'What is the time zone?', answer: 'Costa Rica operates on CST (UTC−6) year-round. There is no daylight saving time adjustment.' },
        { question: 'Do I need a visa?', answer: 'Citizens of the US, UK, EU, Canada, and Australia can enter visa-free for up to 90 days. Confirm requirements for your nationality before travelling.' },
        { question: 'What are emergency numbers?', answer: '911 covers police, fire, and ambulance. The Red Cross (Cruz Roja) operates ambulances and is highly responsive.' },
      ],
    },
  ],
}

function getAdvice(destination: string): AdviceCategory[] {
  return ADVICE[destination] ?? ADVICE['Costa Rica']
}

// ─── Category grouping ────────────────────────────────────────────────────────

const GROUP_DEFS: Array<{
  id: string
  name: string
  keyTip: string
  match: (cat: AdviceCategory) => boolean
}> = [
  {
    id: 'transport',
    name: 'Getting around',
    keyTip: 'A rental car gives the most flexibility — get a 4x4 for remote areas.',
    match: c => c.name.toLowerCase().includes('transportation') || c.id === 'transport',
  },
  {
    id: 'accommodation',
    name: 'Accommodation',
    keyTip: 'Book ahead for peak season — options range from hostels to eco-lodges.',
    match: c => c.name === 'Accommodation' || c.id === 'accommodation',
  },
  {
    id: 'money',
    name: 'Money',
    keyTip: 'USD is accepted almost everywhere. Carry cash for rural areas and local sodas.',
    match: c => c.name === 'Budget & Money' || c.id === 'money',
  },
  {
    id: 'daily',
    name: 'Food & daily life',
    keyTip: 'Eat at sodas for authentic local food. Mobile data is reliable in towns.',
    match: c =>
      ['Food', 'Laundry', 'Daily Logistics', 'Connectivity'].includes(c.name) ||
      ['food', 'connectivity'].includes(c.id),
  },
  {
    id: 'health',
    name: 'Health & safety',
    keyTip: 'Generally safe for solo travel. Pack DEET repellent — mosquitos are prevalent.',
    match: c =>
      ['Safety', 'Packing'].includes(c.name) ||
      ['safety'].includes(c.id),
  },
  {
    id: 'activities',
    name: 'Activities',
    keyTip: 'Book popular tours ahead — national park daily visitor numbers are capped.',
    match: c => c.name === 'Activities' || c.id === 'activities',
  },
  {
    id: 'weather',
    name: 'Weather',
    keyTip: 'August is wet season — expect heavy afternoon rain. Mornings are usually clear.',
    match: c => c.name === 'Weather' || c.id === 'weather',
  },
  {
    id: 'culture',
    name: 'Culture & tips',
    keyTip: '"Pura vida" is the national motto — embrace a slower pace and greet everyone warmly.',
    match: c =>
      ['Local Etiquette', 'Miscellaneous', 'Local life'].includes(c.name) ||
      c.id === 'local',
  },
]

function groupAdvice(cats: AdviceCategory[]): DisplayGroup[] {
  const used = new Set<string>()
  const groups: DisplayGroup[] = []

  for (const def of GROUP_DEFS) {
    const matched = cats.filter(c => !used.has(c.id) && def.match(c))
    if (matched.length === 0) continue
    matched.forEach(c => used.add(c.id))
    groups.push({
      id: def.id,
      name: def.name,
      keyTip: def.keyTip,
      sources: matched,
    })
  }

  // Any category not matched by a group definition gets its own entry
  cats.filter(c => !used.has(c.id)).forEach(c => {
    groups.push({ id: c.id, name: c.name, keyTip: c.keyTip, sources: [c] })
  })

  return groups
}

function cleanSubLabel(name: string): string {
  // "Transportation – Self Driving" → "Self Driving"
  return name.replace(/^[^–\-]+[–\-]\s*/, '').trim() || name
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

function IconEye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function IconEyeOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
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

// ─── Auth screens ─────────────────────────────────────────────────────────────

function PasswordField({
  id, value, onChange, placeholder, autoComplete,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="pw-wrapper">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        className="field-input"
        placeholder={placeholder ?? '••••••••'}
        autoComplete={autoComplete ?? 'current-password'}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      <button
        type="button"
        className="pw-toggle"
        onClick={() => setShow(v => !v)}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <IconEyeOff /> : <IconEye />}
      </button>
    </div>
  )
}

function DisclaimerModal({
  onAcknowledge,
  onCancel,
}: {
  onAcknowledge: () => void
  onCancel: () => void
}) {
  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="modal-panel">
        <div className="modal-handle" aria-hidden="true" />
        <h2 className="modal-title" id="disclaimer-title">Liability disclaimer</h2>
        <p className="modal-body">
          The travel advice provided by Travel Guide is generated by AI and is intended for
          informational purposes only. We do not guarantee the accuracy, completeness, or
          timeliness of any advice. Travel conditions change frequently. Always verify
          critical information with official sources before making travel decisions. By
          proceeding, you acknowledge that Travel Guide and its creators are not liable for
          any loss, injury, or inconvenience arising from the use of this information.
        </p>
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" style={{ flex: 1 }} onClick={onAcknowledge}>
            I acknowledge
          </button>
        </div>
      </div>
    </div>
  )
}

function LoginScreen({
  onLogin,
  onGoSignup,
}: {
  onLogin: () => void
  onGoSignup: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const canSubmit = email.includes('@') && password.length >= 6

  return (
    <div className="auth-shell">
      <p className="auth-wordmark">Travel Guide</p>

      <div className="auth-heading-block">
        <h1 className="auth-heading">Welcome back</h1>
        <p className="auth-subtitle">Log in to access your trips and travel advice.</p>
      </div>

      <div className="form-stack">
        <div className="field-block">
          <label className="field-label" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            className="field-input"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        <div className="field-block">
          <label className="field-label" htmlFor="login-password">Password</label>
          <PasswordField
            id="login-password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
        </div>

        <button className="btn-primary" disabled={!canSubmit} onClick={onLogin}>
          Log in
        </button>
      </div>

      <div className="auth-toggle">
        <span>New here?</span>
        <button className="auth-toggle-link" onClick={onGoSignup}>Create an account</button>
      </div>
    </div>
  )
}

function SignupScreen({
  onComplete,
  onGoLogin,
}: {
  onComplete: () => void
  onGoLogin: () => void
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showDisclaimer, setShowDisclaimer] = useState(false)

  const canSubmit = firstName.trim() && lastName.trim() && email.includes('@') && password.length >= 6

  return (
    <>
      <div className="auth-shell">
        <p className="auth-wordmark">Travel Guide</p>

        <div className="auth-heading-block">
          <h1 className="auth-heading">Create an account</h1>
          <p className="auth-subtitle">Set up your account to get personalised travel advice.</p>
        </div>

        <div className="form-stack">
          <div className="field-block">
            <label className="field-label" htmlFor="signup-first">First name</label>
            <input
              id="signup-first"
              type="text"
              className="field-input"
              placeholder="First name"
              autoComplete="given-name"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
            />
          </div>

          <div className="field-block">
            <label className="field-label" htmlFor="signup-last">Last name</label>
            <input
              id="signup-last"
              type="text"
              className="field-input"
              placeholder="Last name"
              autoComplete="family-name"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
            />
          </div>

          <div className="field-block">
            <label className="field-label" htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              type="email"
              className="field-input"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="field-block">
            <label className="field-label" htmlFor="signup-password">Password</label>
            <PasswordField
              id="signup-password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            />
            <p className="field-hint">At least 6 characters.</p>
          </div>

          <button
            className="btn-primary"
            disabled={!canSubmit}
            onClick={() => setShowDisclaimer(true)}
          >
            Create account
          </button>
        </div>

        <div className="auth-toggle">
          <span>Already have an account?</span>
          <button className="auth-toggle-link" onClick={onGoLogin}>Log in</button>
        </div>
      </div>

      {showDisclaimer && (
        <DisclaimerModal
          onAcknowledge={onComplete}
          onCancel={() => setShowDisclaimer(false)}
        />
      )}
    </>
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

// ─── Destination images ───────────────────────────────────────────────────────

const DESTINATION_IMAGES: Record<string, string> = {
  'Costa Rica': 'https://images.unsplash.com/photo-1580259679654-9276b39fd2d5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
  'Japan': 'https://images.unsplash.com/photo-1681317474675-494bd8e91d7d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
}

// ─── Category icons ───────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, React.ReactElement> = {
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

function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
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
  const groups = groupAdvice(getAdvice(trip.destination))
  const [visited, setVisited] = useState<Set<string>>(new Set())
  const duration = getDuration(trip.startDate, trip.endDate)
  const heroImg = DESTINATION_IMAGES[trip.destination]

  const detail = [
    `${fmtDateShort(trip.startDate)} – ${fmtDate(trip.endDate)}`,
    duration,
    trip.party,
    ...trip.travelStyle,
  ].filter(Boolean).join('  ·  ')

  function handleOpenCategory(groupId: string) {
    setVisited(prev => { const next = new Set(prev); next.add(groupId); return next })
    onOpenCategory(groupId)
  }

  return (
    <>
      <header className="page-header" style={{ borderBottom: heroImg ? 'none' : undefined }}>
        <button className="page-header-btn" onClick={onBack} aria-label="Back to trips">
          <IconArrowLeft />
        </button>
        <span className="page-title" style={{ fontSize: 15 }}>Travel advice</span>
        <div style={{ width: 36 }} />
      </header>

      <div className="page-body">
        {heroImg ? (
          <div className="trip-hero">
            <img className="trip-hero-img" src={heroImg} alt={trip.destination} loading="eager" />
            <div className="trip-hero-scrim" />
            <div className="trip-hero-meta">
              <p className="trip-hero-destination">{trip.destination}</p>
              <p className="trip-hero-detail">{detail}</p>
            </div>
          </div>
        ) : (
          <div className="trip-overview-meta">
            <p className="trip-overview-destination">{trip.destination}</p>
            <p className="trip-overview-detail">{detail}</p>
          </div>
        )}

        <div className="category-list">
          {groups.map((group, i) => {
            const icon = CATEGORY_ICONS[group.id]
            const seen = visited.has(group.id)
            return (
              <button
                key={group.id}
                className="category-row"
                onClick={() => handleOpenCategory(group.id)}
                aria-label={group.name}
              >
                <span className="category-row-num" style={seen ? { color: 'var(--muted-light)' } : undefined}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="category-row-body">
                  <div className="category-row-name-row">
                    {icon && <span className="category-row-icon">{icon}</span>}
                    <p className="category-row-name" style={seen ? { color: 'var(--muted)' } : undefined}>
                      {group.name}
                    </p>
                  </div>
                  <p className="category-row-tip">{group.keyTip}</p>
                </div>
                <span className={seen ? 'category-row-check' : 'category-row-chevron'} aria-hidden="true">
                  {seen ? <IconCheck /> : <IconChevronRight />}
                </span>
              </button>
            )
          })}
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
  const groups = groupAdvice(getAdvice(trip.destination))
  const group = groups.find(g => g.id === categoryId)
  const [activeIdx, setActiveIdx] = useState(0)

  if (!group) return null

  const multiSource = group.sources.length > 1
  const activeSource = group.sources[activeIdx] ?? group.sources[0]

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
          <p className="category-lead-label">{group.name}</p>
          <div className="category-lead-callout">
            <p className="category-lead-tip">{group.keyTip}</p>
          </div>
        </div>

        {multiSource && (
          <div className="tab-strip" role="tablist" aria-label={`${group.name} sections`}>
            {group.sources.map((source, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === activeIdx}
                className={`tab-pill${i === activeIdx ? ' tab-pill-active' : ''}`}
                onClick={() => setActiveIdx(i)}
              >
                {cleanSubLabel(source.name)}
              </button>
            ))}
          </div>
        )}

        <div className="category-qa-list" role={multiSource ? 'tabpanel' : undefined}>
          {activeSource.items.map((item, i) => (
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

// ─── Profile screen ───────────────────────────────────────────────────────────

function ProfileScreen() {
  const [firstName, setFirstName] = useState('Sarah')
  const [lastName, setLastName] = useState('Dreischer')
  const [saved, setSaved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const initials = [firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase()
  const displayName = [firstName, lastName].filter(Boolean).join(' ')

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Profile</h1>
        <div style={{ width: 36 }} />
      </header>

      <div className="page-body">
        {/* Identity */}
        <div className="profile-identity">
          <button
            className="profile-avatar"
            onClick={() => fileRef.current?.click()}
            aria-label="Change profile photo"
          >
            <span className="profile-initials">{initials || '?'}</span>
          </button>
          <div className="profile-name-block">
            <p className="profile-display-name">{displayName || 'Your name'}</p>
            <button
              className="profile-change-photo"
              onClick={() => fileRef.current?.click()}
            >
              Change photo
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            aria-label="Upload profile photo"
          />
        </div>

        {/* Account details form */}
        <span className="section-label" style={{ marginTop: 8, display: 'block' }}>
          Account details
        </span>
        <div className="profile-form">
          <div className="field-block">
            <label className="field-label" htmlFor="profile-first">First name</label>
            <input
              id="profile-first"
              type="text"
              className="field-input"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              autoComplete="given-name"
            />
          </div>
          <div className="field-block">
            <label className="field-label" htmlFor="profile-last">Last name</label>
            <input
              id="profile-last"
              type="text"
              className="field-input"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              autoComplete="family-name"
            />
          </div>
          <button className="btn-primary" onClick={handleSave}>
            {saved ? 'Saved' : 'Save changes'}
          </button>
        </div>

        {/* Account links */}
        <span className="section-label" style={{ marginTop: 24, display: 'block' }}>
          Account
        </span>
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <button className="profile-action-row">
            <span>Terms &amp; Conditions</span>
            <IconChevronRight />
          </button>
          <button className="profile-action-row">
            <span>Log out</span>
            <IconChevronRight />
          </button>
        </div>

        {/* Destructive */}
        <div className="profile-delete-row">
          <button className="profile-delete-btn">Delete account</button>
        </div>
      </div>
    </>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<Screen>({ view: 'login' })
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

  if (screen.view === 'login') {
    return (
      <LoginScreen
        onLogin={() => setScreen({ view: 'destinations' })}
        onGoSignup={() => setScreen({ view: 'signup' })}
      />
    )
  }

  if (screen.view === 'signup') {
    return (
      <SignupScreen
        onComplete={() => setScreen({ view: 'destinations' })}
        onGoLogin={() => setScreen({ view: 'login' })}
      />
    )
  }

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

      {screen.view === 'profile' && <ProfileScreen />}

      {!hideNav && (
        <BottomNav active={navActive()} onNavigate={handleNavNavigate} />
      )}
    </div>
  )
}
