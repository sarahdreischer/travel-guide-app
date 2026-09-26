/**
 * Question Library — the enriched, stable-ID travel question catalogue used by
 * the structured Trip Guide generation stage (stage 2).
 *
 * This does NOT discard the existing question library in `travel-config.ts`
 * (CATEGORY_CONFIG). It builds on it: every question here carries the natural-
 * language `question` text (matching the wording the app already uses) plus
 * stable metadata the generator and the future verification pipeline rely on.
 *
 * Terminology (per the migration):
 *  - "category" is now "topic"       → `topicId`
 *  - "sub-question" is now "question" → the `QuestionDef` entries
 *
 * The `topicId` values line up with the display-group ids in
 * `category-groups.ts` so the generated TripGuide adapts cleanly back onto the
 * existing UI (see trip-guide-adapter.ts).
 */

// ─── Metadata enums ─────────────────────────────────────────────────────────

export type AnswerType =
  | 'recommendation'
  | 'fact'
  | 'price'
  | 'named_entity'
  | 'safety'
  | 'health'
  | 'legal'
  | 'weather'
  | 'packing'
  | 'practical'

export type Risk = 'low' | 'medium' | 'high'
export type Volatility = 'stable' | 'seasonal' | 'volatile'

/**
 * Optional, structured relevance hints. The generator uses these as guidance
 * for excluding irrelevant questions (e.g. don't answer train questions where
 * DestinationFacts establishes there are no trains). Kept intentionally loose
 * (`object`) so it can be extended without a schema migration.
 */
export interface RelevanceRules {
  /** Only relevant if the named DestinationFacts transport mode is present. */
  requiresTransportMode?: 'bus' | 'train' | 'tram' | 'metro' | 'taxi'
  /** Only relevant when the traveller selected this transport mode. */
  requiresTripTransportMode?: 'fly' | 'drive' | 'rail' | 'sail'
  /** Free-form note for the model. */
  note?: string
}

export interface QuestionDef {
  id: string
  topicId: string
  sectionId: string
  question: string
  answerType: AnswerType
  risk: Risk
  volatility: Volatility
  requiresWebVerification: boolean
  relevanceRules?: RelevanceRules
  maxRecommendations?: number
}

// ─── The library ─────────────────────────────────────────────────────────────
//
// Stable IDs use a dotted `topic.section.detail` convention. IDs must never be
// reused for a different meaning — they are referenced by generated GuideItems
// and (later) by verification/feedback.

export const QUESTION_LIBRARY: QuestionDef[] = [
  // ── transport ──────────────────────────────────────────────────────────────
  {
    id: 'transport.driving.recommended',
    topicId: 'transport',
    sectionId: 'driving',
    question: 'Is driving recommended?',
    answerType: 'recommendation',
    risk: 'medium',
    volatility: 'stable',
    requiresWebVerification: false,
  },
  {
    id: 'transport.driving.roads',
    topicId: 'transport',
    sectionId: 'driving',
    question: 'Are roads easy to drive on?',
    answerType: 'fact',
    risk: 'medium',
    volatility: 'stable',
    requiresWebVerification: false,
  },
  {
    id: 'transport.driving.licence',
    topicId: 'transport',
    sectionId: 'driving',
    question: 'What driving licence or permit is required?',
    answerType: 'legal',
    risk: 'high',
    volatility: 'stable',
    requiresWebVerification: true,
    relevanceRules: { requiresTripTransportMode: 'drive', note: 'IDP / licence rules are legal requirements.' },
  },
  {
    id: 'transport.parking.availability',
    topicId: 'transport',
    sectionId: 'parking',
    question: 'Is parking easy and widely available?',
    answerType: 'practical',
    risk: 'low',
    volatility: 'stable',
    requiresWebVerification: false,
  },
  {
    id: 'transport.public_transport.sufficient',
    topicId: 'transport',
    sectionId: 'public_transport',
    question: 'Is public transport sufficient for getting around?',
    answerType: 'recommendation',
    risk: 'low',
    volatility: 'stable',
    requiresWebVerification: false,
  },
  {
    id: 'transport.train.available',
    topicId: 'transport',
    sectionId: 'public_transport',
    question: 'Are trains available and useful for this trip?',
    answerType: 'fact',
    risk: 'low',
    volatility: 'stable',
    requiresWebVerification: false,
    relevanceRules: { requiresTransportMode: 'train' },
  },
  {
    id: 'transport.metro.available',
    topicId: 'transport',
    sectionId: 'public_transport',
    question: 'Is there a metro system, and is it useful for this trip?',
    answerType: 'fact',
    risk: 'low',
    volatility: 'stable',
    requiresWebVerification: false,
    relevanceRules: { requiresTransportMode: 'metro' },
  },
  {
    id: 'transport.tram.available',
    topicId: 'transport',
    sectionId: 'public_transport',
    question: 'Are trams available and useful for this trip?',
    answerType: 'fact',
    risk: 'low',
    volatility: 'stable',
    requiresWebVerification: false,
    relevanceRules: { requiresTransportMode: 'tram' },
  },
  {
    id: 'transport.taxi.prices',
    topicId: 'transport',
    sectionId: 'taxi',
    question: 'How much do taxis cost on average?',
    answerType: 'price',
    risk: 'medium',
    volatility: 'volatile',
    requiresWebVerification: true,
    relevanceRules: { requiresTransportMode: 'taxi' },
  },
  {
    id: 'transport.ride_hailing.availability',
    topicId: 'transport',
    sectionId: 'ride_hailing',
    question: 'Are ride-hailing services available and widely used, and which apps?',
    answerType: 'named_entity',
    risk: 'medium',
    volatility: 'volatile',
    requiresWebVerification: true,
  },
  {
    id: 'transport.airport.transfer',
    topicId: 'transport',
    sectionId: 'airport',
    question: 'What is the best way to get from the airport, and should it be booked in advance?',
    answerType: 'recommendation',
    risk: 'low',
    volatility: 'seasonal',
    requiresWebVerification: false,
    relevanceRules: { requiresTripTransportMode: 'fly' },
  },
  {
    id: 'transport.car_rental.recommended',
    topicId: 'transport',
    sectionId: 'car_rental',
    question: 'Are car rentals recommended, and what should I watch out for?',
    answerType: 'recommendation',
    risk: 'medium',
    volatility: 'volatile',
    requiresWebVerification: false,
  },

  // ── accommodation ────────────────────────────────────────────────────────
  {
    id: 'accommodation.recommended_areas',
    topicId: 'accommodation',
    sectionId: 'areas',
    question: 'Which area should I stay in for my budget and travel style?',
    answerType: 'recommendation',
    risk: 'low',
    volatility: 'stable',
    requiresWebVerification: false,
    maxRecommendations: 2,
  },
  {
    id: 'accommodation.hotels',
    topicId: 'accommodation',
    sectionId: 'hotels',
    question: 'Which hotels are worth booking for my budget?',
    answerType: 'named_entity',
    risk: 'low',
    volatility: 'volatile',
    requiresWebVerification: true,
    maxRecommendations: 3,
  },
  {
    id: 'accommodation.hostels',
    topicId: 'accommodation',
    sectionId: 'hostels',
    question: 'Which hostels are worth booking for my budget?',
    answerType: 'named_entity',
    risk: 'low',
    volatility: 'volatile',
    requiresWebVerification: true,
    maxRecommendations: 3,
  },
  {
    id: 'accommodation.holiday_rentals',
    topicId: 'accommodation',
    sectionId: 'holiday_rentals',
    question: 'Are holiday rentals a good option for my budget and party?',
    answerType: 'recommendation',
    risk: 'low',
    volatility: 'volatile',
    requiresWebVerification: false,
  },

  // ── money ──────────────────────────────────────────────────────────────────
  {
    id: 'money.budget.realistic',
    topicId: 'money',
    sectionId: 'budget',
    question: 'Is my total budget realistic, and what is a realistic daily spend?',
    answerType: 'recommendation',
    risk: 'medium',
    volatility: 'volatile',
    requiresWebVerification: false,
  },
  {
    id: 'money.cash.needed',
    topicId: 'money',
    sectionId: 'cash',
    question: 'Should I bring cash, and how widely are cards accepted?',
    answerType: 'practical',
    risk: 'low',
    volatility: 'stable',
    requiresWebVerification: false,
  },

  // ── food-and-drinks ────────────────────────────────────────────────────────
  {
    id: 'food.restaurants',
    topicId: 'food-and-drinks',
    sectionId: 'restaurants',
    question: 'Which restaurants or local dishes should I try for my budget?',
    answerType: 'named_entity',
    risk: 'low',
    volatility: 'volatile',
    requiresWebVerification: true,
    maxRecommendations: 3,
  },
  {
    id: 'food.tipping',
    topicId: 'food-and-drinks',
    sectionId: 'tipping',
    question: 'Is tipping expected, and how much?',
    answerType: 'practical',
    risk: 'low',
    volatility: 'stable',
    requiresWebVerification: false,
  },
  {
    id: 'food.water.safe',
    topicId: 'food-and-drinks',
    sectionId: 'water',
    question: 'Is tap water safe to drink?',
    answerType: 'health',
    risk: 'high',
    volatility: 'stable',
    requiresWebVerification: true,
  },
  {
    id: 'food.alcohol.prices',
    topicId: 'food-and-drinks',
    sectionId: 'alcohol',
    question: 'How much do alcoholic drinks cost, and where can I buy them?',
    answerType: 'price',
    risk: 'low',
    volatility: 'volatile',
    requiresWebVerification: true,
  },

  // ── health (health & safety) ─────────────────────────────────────────────
  {
    id: 'health.vaccinations',
    topicId: 'health',
    sectionId: 'vaccinations',
    question: 'Which vaccinations are required or recommended for my starting location?',
    answerType: 'health',
    risk: 'high',
    volatility: 'volatile',
    requiresWebVerification: true,
  },
  {
    id: 'health.insects.sun',
    topicId: 'health',
    sectionId: 'environment',
    question: 'Do I need insect repellent and sun protection?',
    answerType: 'health',
    risk: 'medium',
    volatility: 'seasonal',
    requiresWebVerification: false,
  },
  {
    id: 'safety.overview',
    topicId: 'health',
    sectionId: 'safety',
    question: 'How safe is this destination for my party, and are there scams or areas to avoid?',
    answerType: 'safety',
    risk: 'high',
    volatility: 'volatile',
    requiresWebVerification: true,
  },

  // ── activities ─────────────────────────────────────────────────────────────
  {
    id: 'activities.recommendations',
    topicId: 'activities',
    sectionId: 'recommendations',
    question: 'Which activities are worth booking in advance for my preferences?',
    answerType: 'recommendation',
    risk: 'low',
    volatility: 'volatile',
    requiresWebVerification: false,
    maxRecommendations: 3,
  },
  {
    id: 'activities.beaches.swimming',
    topicId: 'activities',
    sectionId: 'beaches',
    question: 'Is it advised to swim at nearby beaches?',
    answerType: 'safety',
    risk: 'medium',
    volatility: 'seasonal',
    requiresWebVerification: false,
  },

  // ── weather ──────────────────────────────────────────────────────────────
  {
    id: 'weather.expected',
    topicId: 'weather',
    sectionId: 'expected',
    question: 'What is the weather likely to be like during my trip?',
    answerType: 'weather',
    risk: 'low',
    volatility: 'seasonal',
    requiresWebVerification: true,
  },

  // ── connectivity ─────────────────────────────────────────────────────────
  {
    id: 'connectivity.esim',
    topicId: 'connectivity',
    sectionId: 'esim',
    question: 'Should I get an eSIM or local SIM, and which provider?',
    answerType: 'recommendation',
    risk: 'low',
    volatility: 'volatile',
    requiresWebVerification: true,
  },

  // ── culture (culture & tips) ─────────────────────────────────────────────
  {
    id: 'culture.greetings',
    topicId: 'culture',
    sectionId: 'greetings',
    question: 'What are common ways to greet people, and what is taboo?',
    answerType: 'practical',
    risk: 'low',
    volatility: 'stable',
    requiresWebVerification: false,
  },

  // ── packing (packing & preparation) ──────────────────────────────────────
  {
    id: 'packing.clothing',
    topicId: 'packing-and-preparation',
    sectionId: 'clothing',
    question: 'What clothing should I pack for the weather and my activities?',
    answerType: 'packing',
    risk: 'low',
    volatility: 'seasonal',
    requiresWebVerification: false,
  },

  // ── practicalities ─────────────────────────────────────────────────────────
  {
    id: 'practicalities.laundry',
    topicId: 'practicalities',
    sectionId: 'laundry',
    question: 'Are laundry services available, and roughly what do they cost?',
    answerType: 'practical',
    risk: 'low',
    volatility: 'volatile',
    requiresWebVerification: false,
  },
]

// ─── Derived lookups ────────────────────────────────────────────────────────

export const QUESTION_IDS = QUESTION_LIBRARY.map((q) => q.id)

const QUESTIONS_BY_ID = new Map(QUESTION_LIBRARY.map((q) => [q.id, q]))

export function getQuestionById(id: string): QuestionDef | undefined {
  return QUESTIONS_BY_ID.get(id)
}

/** All distinct topic ids present in the library, in first-seen order. */
export const TOPIC_IDS: string[] = (() => {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const q of QUESTION_LIBRARY) {
    if (!seen.has(q.topicId)) {
      seen.add(q.topicId)
      ids.push(q.topicId)
    }
  }
  return ids
})()

export function getQuestionsForTopic(topicId: string): QuestionDef[] {
  return QUESTION_LIBRARY.filter((q) => q.topicId === topicId)
}
