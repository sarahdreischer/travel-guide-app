// Hard-coded destination list — Requirements 3.7, 6.2

export const DESTINATIONS = [
  "Costa Rica",
  "Mallorca",
  "Bali",
  "Thailand",
  "Portugal",
  "Japan",
  "Mexico",
  "Greece",
  "Morocco",
  "Colombia",
] as const;

export type Destination = (typeof DESTINATIONS)[number];

export const CATEGORIES = [
  "Transportation – Self Driving",
  "Transportation – Public Transport",
  "Transportation – Serviced",
  "Accommodation",
  "Budget & Money",
  "Connectivity",
  "Packing",
  "Food",
  "Laundry",
  "Daily Logistics",
  "Activities",
  "Weather",
  "Safety",
  "Local Etiquette",
  "Miscellaneous",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CONCISE_TOPICS = [
  "Rental car",
  "Parking",
  "Public transport",
  "Laundry",
  "Airport transport",
  "Mobile data",
  "Cash needed",
  "Tipping expected",
  "Where to eat",
  "Weather conditions",
  "Safety rating",
  "Mosquitos expected",
] as const;

export type ConciseTopic = (typeof CONCISE_TOPICS)[number];
