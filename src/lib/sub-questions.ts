// Sub-questions per category — Requirement 6.4

import { type Category } from "@/lib/destinations";

const SUB_QUESTIONS: Record<Category, string[]> = {
  "Transportation \u2013 Self Driving": [
    "Is driving recommended?",
    "Are roads in good condition?",
    "Is rental car recommended?",
    "Are mountain roads difficult?",
    "Is parking easy?",
    "Is parking widely available?",
    "What are the parking rules?",
  ],
  "Transportation \u2013 Public Transport": [
    "Is public transport sufficient?",
    "How can I pay for buses?",
    "How can I pay for trains?",
  ],
  "Transportation \u2013 Serviced": [
    "Should I book airport transport in advance?",
    "Are taxis/Uber readily available?",
  ],
  "Accommodation": [
    "Which area should I stay in?",
    "Hotel, hostel or Airbnb?",
    "Private room or shared dorm?",
    "Is it social?",
    "Is accommodation likely to sell out?",
  ],
  "Budget & Money": [
    "Do I need to bring cash?",
    "Do most places take card or cash?",
    "Which cards are widely accepted?",
    "How expensive is the destination?",
    "What is a realistic daily budget?",
  ],
  "Connectivity": [
    "Should I buy an eSIM?",
    "Which eSIM provider is best?",
    "How reliable is mobile data?",
    "Is Wi-Fi generally reliable?",
    "Is the destination suitable for remote work?",
  ],
  "Packing": [
    "Should I pack shorts/tops/t-shirts?",
    "Should I pack long trousers/shirts?",
    "Do I need hiking shoes?",
    "Do I need insect repellent?",
    "Do I need sunscreen?",
    "What SPF is recommended?",
    "Do I need a rain coat?",
    "Do I need an umbrella?",
    "Do I need a dry bag?",
  ],
  "Food": [
    "Is tipping expected?",
    "Where do locals eat?",
    "What local dishes should I try?",
    "Is street food safe?",
    "What are average meal prices?",
  ],
  "Laundry": [
    "Are there self-service laundrettes?",
    "How expensive are self-service laundrettes?",
    "Are there service wash laundrettes?",
    "How expensive are service wash laundrettes?",
    "Do laundrettes take cash and/or card?",
  ],
  "Daily Logistics": [
    "What supermarkets are recommended?",
    "Can I drink tap water?",
    "What are popular pharmacies?",
    "Are ATMs widely available?",
    "Is sunscreen expensive?",
  ],
  "Activities": [
    "Which activities are worth booking?",
    "Which activities are tourist traps?",
    "Should I book ahead?",
    "What are hidden gems?",
    "Is it advised to swim in nearby beaches?",
  ],
  "Weather": [
    "Are rain showers common?",
    "Is it mostly sunny?",
    "Does it rain occasionally?",
    "Is drizzle rain common?",
    "Are there specific times to avoid going outside?",
  ],
  "Safety": [
    "Is it safe for solo travellers?",
    "Are there scams to watch out for?",
    "Which areas should I avoid?",
    "Is phone theft common?",
    "Is it safe at night?",
    "Is it safe for women to walk around alone?",
  ],
  "Local Etiquette": [],
  "Miscellaneous": [
    "What are things I wish I had known?",
  ],
};

export function getSubQuestions(category: Category): string[] {
  if (!(category in SUB_QUESTIONS)) {
    throw new Error(`Unknown category: "${category}"`);
  }
  return SUB_QUESTIONS[category];
}
