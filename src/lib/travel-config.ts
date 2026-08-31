/**
 * Central configuration for all travel topics, categories, questions, and mappings.
 *
 * To add a new category: add it to CATEGORY_CONFIG below with its sub-questions.
 * To change how categories are grouped on the home page: edit GROUP_DEFS in category-groups.ts.
 * To add a new destination: add it to DESTINATIONS.
 *
 * Everything else (types, helper functions) is derived automatically.
 */

// ─── Destinations ─────────────────────────────────────────────────────────────

export const DESTINATIONS = [
  'Argentina',
  'Australia',
  'Bali, Indonesia',
  'Indonesia',
  'Barcelona, Spain',
  'Cambodia',
  'Canada',
  'Cap Ferret, France',
  'Chile',
  'Colombia',
  'Costa Rica',
  'Croatia',
  'Cuba',
  'Egypt',
  'France',
  'Georgia',
  'Greece',
  'Iceland',
  'India',
  'Italy',
  'Japan',
  'Jordan',
  'Kenya',
  'Laos',
  'Malaysia',
  'Mexico',
  'Morocco',
  'Nepal',
  'New Zealand',
  'Norderney, Germany',
  'Norway',
  'Peru',
  'Philippines',
  'Phuket, Thailand',
  'Portugal',
  'Scotland',
  'South Africa',
  'Spain',
  'Sri Lanka',
  'Switzerland',
  'Thailand',
  'Turkey',
  'Vietnam',
] as const

export type Destination = (typeof DESTINATIONS)[number]

// ─── Categories and Sub-Questions ─────────────────────────────────────────────
//
// Each category has a list of sub-questions the AI will answer.
// To add a new category, add an entry here. To add questions to an existing
// category, just append to the array.

export const CATEGORY_CONFIG = {
  'Transportation – Driving': [
    'Is driving recommended?',
    'Are roads easy to drive on?',
    'Are there mountain roads that are difficult to drive?',
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
  'Transportation – Taxis and Ride-Hailing Services': [
    'How much are taxis on average?',
    'Are ride-hailing services available and widely used?',
    'How much are ride-hailing service trips on average?',
  ],
  'Transportation - Car Rental': [
    'Are car rentals recommended?',
    'What should I watch out for when renting a car?',
    'How much do car rentals cost on average?',
    'What type of car is recommended for rental?',
    'Which providers are best for car rentals?',
  ],
  'Transportation - Airport Transfer': [
    'How much does airport transport cost on average?',
    'Should I book airport transport in advance?',
  ],
  'Recommended Areas': [
    'Which area should I stay in according to my budget and activity preferences?'
  ],
  'Hotels': [
    'What are the top 3 hotels to book according to my budget?',
    'What are average hotel prices?',
    'Are hotels likely to sell out?',
  ],
  'Hostels': [
    'What are the top 3 hostels to book according to my budget?',
    'What are average hostel prices?',
    'Are hostels likely to sell out?',
  ],
  'Holiday Rentals': [
    'What are the top 3 holiday rentals according to my budget?',
    'What are average holiday rental prices?',
    'Are holiday rentals likely to sell out?',
  ],
  'Money': [
    'Is my current budget realistic?',
    'Should I bring cash in advance of the trip?',
    'Are ATMs widely available?',
    'What is the average fee charge for withdrawals from ATMs?',
    'Do most places accept card payment?',
    'Which cards are widely accepted?',
    'What is a realistic daily budget?',
  ],
  'WiFi & Mobile Data': [
    'Is Wi-Fi generally reliable?',
    'How reliable is mobile data?',
    'Does the area provide 4G (LTE) and 5G coverage reliable?',
    'Should I buy an eSIM?',
    'Which eSIM provider offers the best prices?',
    'Is the destination suitable for remote work?',
  ],
  'Clothing & Accessories': [
    'What type of clothes should I pack?',
    'What type of clothes should I pack for my activity preferences?',
    'Do I need insect repellent?',
    'Do I need sunscreen? If yes, what SPF is recommended?',
    'Do I need a rain coat?',
    'Do I need an umbrella?',
    'Do I need a dry bag?',
  ],
  'Health': [
    'Are mosquitos and other insects prevalent?',
    'Do I need insect repellent?',
    'What is the expected UV strength?',
    'Do I need sunscreen and, if yes, what SPF is recommended?',
    'Which vaccinations do I need to have?',
    'Do I need to proof my vaccination status on arrival?',
    'What vaccinations are recommended for me considering my starting location?',
    'What are popular pharmacies?',
  ],
  'Food & Tipping Culture': [
    'Which top 3 restaurants should I try?',
    'Where do locals eat?',
    'What local dishes should I try?',
    'Is tipping expected?',
    'Is street food safe?',
    'Which international fast food chains are available?',
    'What are average meal prices?',
  ],
  'Laundry': [
    'Are there self-service laundrettes?',
    'How expensive are self-service laundrettes?',
    'Are there service wash laundrettes?',
    'How expensive are service wash laundrettes?',
    'Do laundrettes take cash and/ or card?',
  ],
  'Groceries & Drinking Water': [
    'What supermarkets are recommended?',
    'Is tap water safe to drink?',
  ],
  'Activities': [
    'Which activities are worth booking in advance according to my activity preferences?',
    'Which activities are tourist traps?',
    'Which additional activities are popular?',
    'What are hidden gems?',
    'Is it advised to swim in nearby beaches?',
  ],
  'Weather': [
    'What is the weather likely going to look like?',
    'Are rain showers common?',
    'Is it mostly sunny?',
    'How strong will the sun be? What SPF is recommended, if any at all?',
    'Does it rain occasionally?',
    'Is drizzle rain common?',
    'What are the average humidity levels?',
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
  ],
  'Alcoholic Drinks': [
    'How much are alcoholic drinks on average (at restaurants/ bars/ pubs etc.)?',
    'What are the top 3 bars?',
    'What are the top 3 pubs?',
    'Where can I easily buy alcoholic drinks for private use?',
    'Are alcoholic drinks highly taxed?',
  ],
  'Miscellaneous': [
    'What are things I wish I had known?',
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

