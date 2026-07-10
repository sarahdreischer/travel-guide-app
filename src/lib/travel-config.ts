/**
 * Central configuration for all travel topics, categories, questions, and mappings.
 *
 * To add a new category: add it to CATEGORY_CONFIG below with its sub-questions.
 * To add a new concise topic: add it to CONCISE_TOPIC_MAPPING below.
 * To add a new destination: add it to DESTINATIONS.
 *
 * Everything else (types, helper functions) is derived automatically.
 */

// ─── Destinations ─────────────────────────────────────────────────────────────

export const DESTINATIONS = [
  'Costa Rica',
  'Mallorca',
  'Bali',
  'Thailand',
  'Portugal',
  'Japan',
  'Mexico',
  'Greece',
  'Morocco',
  'France - Cap Ferret',
] as const

export type Destination = (typeof DESTINATIONS)[number]

// ─── Categories and Sub-Questions ─────────────────────────────────────────────
//
// Each category has a list of sub-questions the AI will answer.
// To add a new category, add an entry here. To add questions to an existing
// category, just append to the array.

export const CATEGORY_CONFIG = {
  'Transportation – Self Driving': [
    'Is driving recommended?',
    'Are roads easy to drive on?',
    'Are mountain roads difficult?',
  ],
  'Transportation - Car Rental': [
    'Is rental car recommended?',
    'What should I watch out for when renting a car?',
    'How much do car rentals cost on average?',
    'What type of car is recommended for rental?',
    'Which providers are best for car rentals?',
  ],
  'Transportation - Parking': [
    'Is parking easy?',
    'Is parking widely available?',
    'What are the parking rules?',
  ],
  'Transportation – Public Transport': [
    'Is public transport sufficient?',
    'How can I pay for buses?',
    'How can I pay for trains?',
    'How can I pay for trams if available?',
    'How can I pay for metros if available?',
  ],
  'Transportation – Serviced': [
    'Should I book airport transport in advance?',
    'How much does airport transport cost on average?',
    'Are taxis or other transportation companies readily available?',
    'Which transportation companies other than local taxis are widely used?',
  ],
  'Accommodation': [
    'Which area should I stay in?',
    'Is accommodation likely to sell out?',
  ],
  'Budget & Money': [
    'Do I need to bring cash?',
    'Do most places take card or cash?',
    'Which cards are widely accepted?',
    'How expensive is the destination?',
    'What is a realistic daily budget?',
  ],
  'Connectivity': [
    'Should I buy an eSIM?',
    'Which eSIM provider offers the best prices?',
    'How reliable is mobile data?',
    'Is Wi-Fi generally reliable?',
    'Is the destination suitable for remote work?',
  ],
  'Packing': [
    'Should I pack shorts/tops/t-shirts?',
    'Should I pack long trousers/shirts?',
    'Do I need hiking shoes?',
    'Do I need insect repellent?',
    'Do I need sunscreen?',
    'What SPF is recommended?',
    'Do I need a rain coat?',
    'Do I need an umbrella?',
    'Do I need a dry bag?',
  ],
  'Food': [
    'Is tipping expected?',
    'Where do locals eat?',
    'What local dishes should I try?',
    'Is street food safe?',
    'What are average meal prices?',
  ],
  'Laundry': [
    'Are there self-service laundrettes?',
    'How expensive are self-service laundrettes?',
    'Are there service wash laundrettes?',
    'How expensive are service wash laundrettes?',
    'Do laundrettes take cash and/or card?',
  ],
  'Daily Logistics': [
    'What supermarkets are recommended?',
    'Can I drink tap water?',
    'What are popular pharmacies?',
    'Are ATMs widely available?',
    'Is sunscreen expensive?',
  ],
  'Activities': [
    'Which activities are worth booking?',
    'Which activities are tourist traps?',
    'Should I book ahead?',
    'What are hidden gems?',
    'Is it advised to swim in nearby beaches?',
  ],
  'Weather': [
    'Are rain showers common?',
    'Is it mostly sunny?',
    'Does it rain occasionally?',
    'Is drizzle rain common?',
    'Are there specific times to avoid going outside?',
  ],
  'Safety': [
    'Is it safe for solo travellers?',
    'Are there scams to watch out for?',
    'Which areas should I avoid?',
    'Is phone theft common?',
    'Is it safe at night?',
    'Is it safe for women to walk around alone?',
  ],
  'Local Etiquette': [
    'What are common ways to greet people?',
    'What is taboo?',
  ] as string[],
  'Miscellaneous': [
    'What are things I wish I had known?',
    'Where can I easily buy alcoholic drinks?',
    'Are alcoholic drinks highly taxed?',
  ],
} as const satisfies Record<string, readonly string[]>

// Derived types and arrays
export type Category = keyof typeof CATEGORY_CONFIG
export const CATEGORIES = Object.keys(CATEGORY_CONFIG) as Category[]

/**
 * Get the sub-questions for a category.
 */
export function getSubQuestions(category: string): string[] {
  if (!(category in CATEGORY_CONFIG)) {
    throw new Error(`Unknown category: "${category}"`)
  }
  return [...CATEGORY_CONFIG[category as Category]]
}

// ─── Concise Topic Mapping ────────────────────────────────────────────────────
//
// Maps the 12 summary cards on the home page to a specific (category, question).
// To add a new concise topic: add an entry here. It will auto-appear on the home page.

export const CONCISE_TOPIC_MAPPING = {
  'Rental car': {
    category: 'Transportation - Car Rental',
    question: 'Is rental car recommended?',
  },
  'Parking': {
    category: 'Transportation - Parking',
    question: 'Is parking easy?',
  },
  'Public transport': {
    category: 'Transportation – Public Transport',
    question: 'Is public transport sufficient?',
  },
  'Laundry': {
    category: 'Laundry',
    question: 'Are there self-service laundrettes?',
  },
  'Airport transport': {
    category: 'Transportation – Serviced',
    question: 'Should I book airport transport in advance?',
  },
  'Mobile data': {
    category: 'Connectivity',
    question: 'How reliable is mobile data?',
  },
  'Cash needed': {
    category: 'Budget & Money',
    question: 'Do I need to bring cash?',
  },
  'Tipping expected': {
    category: 'Food',
    question: 'Is tipping expected?',
  },
  'Where to eat': {
    category: 'Food',
    question: 'Where do locals eat?',
  },
  'Weather conditions': {
    category: 'Weather',
    question: 'Are rain showers common?',
  },
  'Safety rating': {
    category: 'Safety',
    question: 'Is it safe for solo travellers?',
  },
  'Mosquitos expected': {
    category: 'Packing',
    question: 'Do I need insect repellent?',
  },
} as const satisfies Record<string, { category: Category; question: string }>

export type ConciseTopic = keyof typeof CONCISE_TOPIC_MAPPING
export const CONCISE_TOPICS = Object.keys(CONCISE_TOPIC_MAPPING) as ConciseTopic[]
