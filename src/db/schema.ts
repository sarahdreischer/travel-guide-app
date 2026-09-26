import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  date,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { customType } from 'drizzle-orm/pg-core'

// Custom citext column type — PostgreSQL case-insensitive text extension
const citext = customType<{ data: string }>({
  dataType() {
    return 'citext'
  },
})

// ─── users ────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  profileImagePath: text('profile_image_path'),
  setupComplete: boolean('setup_complete').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ─── sessions ─────────────────────────────────────────────────────────────────

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ─── login_attempts ───────────────────────────────────────────────────────────

export const loginAttempts = pgTable('login_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: citext('email').notNull().unique(),
  failedCount: integer('failed_count').notNull().default(0),
  lockedUntil: timestamp('locked_until'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ─── trips ────────────────────────────────────────────────────────────────────

export const trips = pgTable('trips', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  destination: text('destination').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  travelMode: text('travel_mode').notNull(),
  transportMode: text('transport_mode'), // 'fly' | 'drive' | 'rail' | 'sail' — nullable for legacy rows
  startingLocation: text('starting_location'), // city, country — nullable for legacy rows
  budgetUsd: integer('budget_usd').notNull(),
  transportCostIncluded: boolean('transport_cost_included').notNull().default(true),
  travelStyle: text('travel_style').notNull(),
  activityPreferences: text('activity_preferences').array().notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ─── advice_cache ─────────────────────────────────────────────────────────────

export const adviceCache = pgTable(
  'advice_cache',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    destination: citext('destination').notNull(),
    startMonth: citext('start_month').notNull(),
    endMonth: citext('end_month').notNull(),
    travellerType: citext('traveller_type').notNull(),
    budgetRange: text('budget_range').notNull(), // 'budget' | 'mid' | 'luxury'
    category: text('category').notNull(),
    answers: jsonb('answers').notNull(), // Record<subQuestionKey, string>
    generatedAt: timestamp('generated_at').notNull().defaultNow(),
  },
  (t) => ({
    cacheKeyIdx: uniqueIndex('advice_cache_key_idx').on(
      t.destination,
      t.startMonth,
      t.endMonth,
      t.travellerType,
      t.budgetRange,
      t.category,
    ),
  }),
)

// ─── destination_facts ─────────────────────────────────────────────────────────
//
// Stage-1 destination research output: the STABLE baseline facts for a
// destination, established from external web sources. Cached and reusable
// across trips (100 trips to Phuket reuse one row) and independently
// refreshable via `lastResearchedAt`.

export const destinationFacts = pgTable(
  'destination_facts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Case-insensitive natural key so lookups match regardless of casing.
    destination: citext('destination').notNull(),
    country: citext('country').notNull(),
    // The validated DestinationFacts object (schema: DestinationFactsSchema).
    facts: jsonb('facts').notNull(),
    lastResearchedAt: timestamp('last_researched_at').notNull().defaultNow(),
  },
  (t) => ({
    destinationKeyIdx: uniqueIndex('destination_facts_key_idx').on(t.destination, t.country),
  }),
)

// ─── trip_guides ─────────────────────────────────────────────────────────────
//
// Stage-2 structured Trip Guide output. Keyed by the same cache dimensions as
// advice_cache so it is reusable across identical trips, plus a reference to
// the destination_facts row it was generated from.

export const tripGuides = pgTable(
  'trip_guides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    destination: citext('destination').notNull(),
    startMonth: citext('start_month').notNull(),
    endMonth: citext('end_month').notNull(),
    travellerType: citext('traveller_type').notNull(),
    budgetRange: text('budget_range').notNull(),
    // The validated TripGuide object (schema: TripGuideSchema).
    guide: jsonb('guide').notNull(),
    // The destination_facts row this guide was generated from (nullable so a
    // guide is never blocked if facts are later pruned).
    destinationFactsId: uuid('destination_facts_id').references(() => destinationFacts.id, {
      onDelete: 'set null',
    }),
    // Topic-level completeness for on-view reconciliation. `complete` is false
    // when at least one relevant topic failed to generate (content failure) or
    // a provider failure short-circuited the run; such guides are topped up on
    // the next view. `attemptedTopics` records the topic ids attempted in the
    // most recent run (nullable for legacy rows / unknown).
    complete: boolean('complete').notNull().default(false),
    attemptedTopics: jsonb('attempted_topics'), // string[] | null
    // The question-library ids this guide "covers" (offered to the model across
    // its generated topics). Enables question-level staleness: when a new
    // question is added to the library, existing guides missing that id are
    // detected as stale on open and the affected topic is regenerated.
    // Nullable for legacy rows (unknown coverage).
    coveredQuestions: jsonb('covered_questions'), // string[] | null
    generatedAt: timestamp('generated_at').notNull().defaultNow(),
  },
  (t) => ({
    tripGuideKeyIdx: uniqueIndex('trip_guides_key_idx').on(
      t.destination,
      t.startMonth,
      t.endMonth,
      t.travellerType,
      t.budgetRange,
    ),
  }),
)

// ─── destination_images ───────────────────────────────────────────────────────

export const destinationImages = pgTable('destination_images', {
  destination: text('destination').primaryKey(), // matches DESTINATIONS values exactly
  imageUrl: text('image_url').notNull(),
  attribution: text('attribution'), // photographer name / Unsplash credit
})

// ─── saved_tips ───────────────────────────────────────────────────────────────

export const savedTips = pgTable(
  'saved_tips',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    category: text('category').notNull(),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    userTripQuestionUnique: uniqueIndex('saved_tips_user_trip_q_idx').on(
      t.userId,
      t.tripId,
      t.category,
      t.question,
    ),
  }),
)

// ─── votes ────────────────────────────────────────────────────────────────────

export const votes = pgTable(
  'votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    adviceId: uuid('advice_id')
      .notNull()
      .references(() => adviceCache.id, { onDelete: 'cascade' }),
    voteType: text('vote_type').notNull(), // 'accurate' | 'outdated'
    experienceNote: text('experience_note'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    userAdviceUnique: uniqueIndex('votes_user_advice_idx').on(t.userId, t.adviceId),
  }),
)

// ─── password_reset_tokens ────────────────────────────────────────────────────

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ─── Type exports ─────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert

export type LoginAttempt = typeof loginAttempts.$inferSelect
export type NewLoginAttempt = typeof loginAttempts.$inferInsert

export type Trip = typeof trips.$inferSelect
export type NewTrip = typeof trips.$inferInsert

export type AdviceCache = typeof adviceCache.$inferSelect
export type NewAdviceCache = typeof adviceCache.$inferInsert

export type Vote = typeof votes.$inferSelect
export type NewVote = typeof votes.$inferInsert

export type DestinationImage = typeof destinationImages.$inferSelect
export type NewDestinationImage = typeof destinationImages.$inferInsert

export type DestinationFactsRow = typeof destinationFacts.$inferSelect
export type NewDestinationFactsRow = typeof destinationFacts.$inferInsert

export type TripGuideRow = typeof tripGuides.$inferSelect
export type NewTripGuideRow = typeof tripGuides.$inferInsert

export type SavedTip = typeof savedTips.$inferSelect
export type NewSavedTip = typeof savedTips.$inferInsert

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert
