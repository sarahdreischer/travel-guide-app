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
  budgetUsd: integer('budget_usd').notNull(),
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
