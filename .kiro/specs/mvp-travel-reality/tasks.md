# Implementation Plan: MVPTravel Reality

## Overview

Implement the MVPTravel Reality web application incrementally, starting with the project skeleton and database schema, then building authentication, new-user setup, trip creation and AI advice generation, the home page cards, voting, the destinations list page, and the profile page. Each task wires into the running app before the next begins. TypeScript + Next.js 15 App Router + Drizzle ORM + PostgreSQL + Tailwind CSS + Vercel AI SDK throughout.

---

## Tasks

- [x] 1. Project scaffold and database foundation
  - [x] 1.1 Initialise Next.js 15 App Router project with TypeScript, Tailwind CSS, ESLint, and path aliases
    - Bootstrap with `create-next-app`, enable App Router, configure `tsconfig.json` and `tailwind.config.ts` for mobile-first breakpoints (375 px base)
    - _Requirements: 10.1, 10.4_

  - [x] 1.2 Install and configure Drizzle ORM with PostgreSQL (`pg` driver)
    - Add `drizzle-orm`, `drizzle-kit`, `pg`, `@types/pg`; create `db/index.ts` Drizzle client reading `DATABASE_URL` from env; add `drizzle.config.ts`
    - _Requirements: 4.6_

  - [x] 1.3 Write all Drizzle table definitions in `db/schema.ts`
    - Tables: `users`, `sessions`, `login_attempts`, `trips`, `advice_cache` (with `citext` columns + unique composite index), `votes`; mirror the ERD and schema highlights from the design exactly
    - _Requirements: 1.1, 2.2, 3.1, 4.6, 7.2_

  - [x] 1.4 Generate and run initial Drizzle migration
    - Run `drizzle-kit generate` and `drizzle-kit migrate`; verify all tables and indexes exist in the database
    - _Requirements: 4.6_

  - [x] 1.5 Create `lib/destinations.ts` with the 10 hard-coded destination constants
    - Export `DESTINATIONS: string[]` with Costa Rica, Mallorca, and 8 additional entries; export `CATEGORIES` constant with the 15 category names
    - _Requirements: 3.7, 6.2_

- [x] 2. Core validation and utility library
  - [x] 2.1 Implement pure validation helpers in `lib/validators.ts`
    - `derivebudgetRange(usd: number): 'budget' | 'mid' | 'luxury'` (tiers: $1–$99 → budget, $100–$499 → mid, $500–$1 000 000 → luxury); `validateUsername(name: string): boolean`; `validateExperienceNote(text: string): boolean`; `validateProfileImage(file: { mimeType: string; size: number }): ImageValidationResult`; `validateEmail(email: string): boolean`; `validateTripDates(start: Date, end: Date): TripDateValidationResult`; `normaliseCacheKey(key: CacheKey): CacheKey`
    - _Requirements: 2.3, 2.4, 2.7, 3.1, 3.5, 3.6, 4.1, 7.4, 7.8, 9.2, 9.3_

  - [ ]* 2.2 Write property-based tests for `derivebudgetRange`
    - **Property 8: Budget Range Derivation Completeness**
    - **Validates: Requirements 3.1, 4.1**
    - Use `fc.integer({ min: 1, max: 1_000_000 })`; assert result is always one of `['budget','mid','luxury']` and never throws

  - [ ]* 2.3 Write property-based tests for `validateUsername`
    - **Property 9: Username Validation Constraint**
    - **Validates: Requirements 9.2**
    - Use `fc.string()` of length 0–300; assert accepted iff 1 ≤ length ≤ 255

  - [ ]* 2.4 Write property-based tests for `validateExperienceNote`
    - **Property 6: Experience Note Length Constraint**
    - **Validates: Requirements 7.4, 7.8**
    - Use `fc.string()` of length 0–600; assert accepted iff 1 ≤ length ≤ 500

  - [ ]* 2.5 Write property-based tests for `validateProfileImage`
    - **Property 10: Profile Image Validation**
    - **Validates: Requirements 2.7, 9.3**
    - Use `fc.record({ mimeType: fc.string(), size: fc.integer() })`; assert accepted iff mimeType ∈ {image/jpeg,image/png,image/webp} AND size ≤ 5 242 880

  - [ ]* 2.6 Write property-based tests for `validateTripDates`
    - **Property 7: Trip Date Ordering Invariant**
    - **Validates: Requirements 3.5, 3.6**
    - Use `fc.date()` pairs; assert rejected iff start < today or end < start

  - [ ]* 2.7 Write property-based tests for `validateEmail`
    - **Property 15: Email Format Validation**
    - **Validates: Requirements 2.4**
    - Mix of valid and invalid email strings; assert accepted iff matches `local-part@domain.tld` pattern

  - [x] 2.8 Implement `lib/sub-questions.ts` — `getSubQuestions(category: Category): string[]`
    - Return the exact sub-question list for each of the 15 categories as specified in Requirement 6.4; throw on unknown category
    - _Requirements: 6.4_

  - [ ]* 2.9 Write property-based tests for `getSubQuestions`
    - **Property 16: Sub-Question Completeness Per Category**
    - **Validates: Requirements 6.4**
    - Use `fc.constantFrom(...CATEGORIES)`; assert returned list is non-empty and matches the expected list exactly for every category

- [x] 3. Checkpoint — Ensure all tests pass
  - Run `jest --passWithNoTests`; fix any type errors from `tsc --noEmit`; ask the user if questions arise.

- [x] 4. Auth_Service and session middleware
  - [x] 4.1 Implement `lib/auth.ts` — `Auth_Service`
    - `login()`: look up user by email → compare bcrypt hash (cost 12) → call `checkRateLimit()` → create 32-byte hex session token → INSERT into `sessions` with 24-hour expiry; `getSession()`: SELECT from `sessions` JOIN `users` where token matches and `expires_at > NOW()`; `logout()`: DELETE session row; `checkRateLimit()`: read `login_attempts` for email → return locked if `locked_until > NOW()`; on each failed attempt: increment `failed_count`, set `locked_until = NOW() + 15 min` when count reaches 5
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.7_

  - [ ]* 4.2 Write property-based tests for rate-limit logic
    - **Property 12: Login Rate-Limiting Lock Threshold**
    - **Validates: Requirements 1.5**
    - Use `fc.integer({ min: 0, max: 10 })` failed-attempt count; assert locked iff consecutive failures ≥ 5; assert locked account is rejected regardless of correct password

  - [x] 4.3 Implement `middleware.ts` — session guard for `(app)/**` routes
    - Read `session_token` HttpOnly cookie; call `getSession()`; redirect to `/login` if null or expired; pass through otherwise
    - _Requirements: 1.6, 1.7_

  - [x] 4.4 Implement `actions/auth.ts` Server Actions — `loginAction`, `logoutAction`
    - `loginAction`: call `Auth_Service.login()`, set `session_token` HttpOnly Secure SameSite=Lax cookie, redirect to `/home`; `logoutAction`: call `Auth_Service.logout()`, clear cookie, redirect to `/login`
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [x] 4.5 Build `app/(auth)/login/page.tsx` with `components/forms/LoginForm.tsx`
    - Email input, password input, Login button; disable button while form is submitting; show inline error from Server Action result; show lock message when account is locked; all inputs have 44 × 44 px minimum touch targets
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 10.5_

- [x] 5. New-user setup flow
  - [x] 5.1 Implement `lib/profile.ts` — `Profile_Service`
    - `create()`: INSERT into `users` setting `setup_complete = true`; `update()`: UPDATE user row; `deleteAccount()`: DELETE user row (cascades sessions, trips, votes via FK); `validateImage()`: call shared `validateProfileImage()` from `lib/validators.ts`
    - _Requirements: 2.2, 2.3, 2.7, 9.2, 9.3, 9.6_

  - [ ]* 5.2 Write property-based tests for account deletion cascade
    - **Property 11: Account Deletion Cascade**
    - **Validates: Requirements 9.6**
    - Seed users with random counts of trips/sessions/votes; call `deleteAccount()`; assert zero rows remain in `trips`, `sessions`, `votes` for that `user_id`

  - [x] 5.3 Implement `actions/profile.ts` Server Actions — `setupProfileAction`, `updateProfileAction`, `deleteAccountAction`
    - `setupProfileAction`: validate fields via `lib/validators.ts`, save via `Profile_Service.create()`, redirect to `/home`; `updateProfileAction`: validate and update; `deleteAccountAction`: call `Profile_Service.deleteAccount()`, clear session cookie, redirect to `/login`
    - _Requirements: 2.3, 2.4, 2.7, 2.8, 9.2, 9.3, 9.6_

  - [x] 5.4 Build `app/(setup)/setup/page.tsx` with `components/forms/SetupForm.tsx`
    - First name, last name, email, optional profile image upload; field-level validation errors; on valid submit, open `LiabilityDisclaimerModal`; modal has "I acknowledge" and "Cancel" buttons; "Cancel" closes modal without submitting; "I acknowledge" triggers `setupProfileAction`; middleware redirects any non-setup-complete user to `/setup` before allowing access to `(app)/**`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ]* 5.5 Write property-based tests for setup form field validation
    - **Property 14: Setup Form Required Field Validation**
    - **Validates: Requirements 2.3**
    - Use `fc.subarray(['firstName','lastName','email'])` of fields to omit; assert field-level error shown per omitted field; assert profile NOT created if any required field missing


- [x] 6. Checkpoint — Ensure all tests pass
  - Run `jest --passWithNoTests` and `tsc --noEmit`; verify login flow end-to-end; ask the user if questions arise.

- [x] 7. LLM_Adapter and Advice_Store
  - [x] 7.1 Implement `lib/advice-store.ts` — `Advice_Store`
    - `findByCacheKey()`: SELECT from `advice_cache` using composite index on `(destination, month, traveller_type, budget_range, category)` with citext/lower comparisons; `save()`: INSERT advice row, return row; `getForTrip()`: JOIN trips → advice_cache via derived cache key
    - _Requirements: 4.2, 4.3, 4.6_

  - [ ]* 7.2 Write property-based tests for Advice_Store cache round-trip
    - **Property 1: Cache Round-Trip (Idempotence + Case-Insensitivity)**
    - **Validates: Requirements 4.2, 4.3**
    - Use `fc.tuple(fc.string(), fc.string(), fc.string(), fc.string())` for key components in random case; assert `findByCacheKey` returns same row for all case variants; assert exactly one DB row after multiple calls with same logical key

  - [ ]* 7.3 Write property-based tests for Advice_Store write-before-read consistency
    - **Property 2: Advice Write-Before-Read Consistency**
    - **Validates: Requirements 4.4, 4.6**
    - Random `AdviceRecord` data; call `save()` then `findByCacheKey()`; assert returned record is identical to what was saved

  - [x] 7.4 Implement `lib/llm-adapter.ts` — `LLM_Adapter` with Vercel AI SDK
    - `generateAdvice()`: build prompt from cacheKey + category + subQuestions, call configured Vercel AI SDK model with 30-second `AbortSignal` timeout, parse structured JSON response (answers keyed by sub-question), on success call `Advice_Store.save()`, on timeout/error log server-side and throw `AdviceTimeoutError`; `summarise()`: call model to generate a single-sentence summary of full advice text
    - _Requirements: 4.1, 4.4, 4.5, 4.7, 4.8, 5.4_

  - [x] 7.5 Implement `actions/advice.ts` Server Action — `getOrGenerateAdviceAction`
    - For each of the 15 categories: call `Advice_Store.findByCacheKey()` → on cache hit return cached advice → on cache miss call `LLM_Adapter.generateAdvice()`; handle `AdviceTimeoutError` and write failures per design error table; return structured result to client
    - _Requirements: 4.2, 4.3, 4.4, 4.7, 4.8_


- [x] 8. Trip creation
  - [x] 8.1 Implement `actions/trip.ts` Server Action — `createTripAction`
    - Validate all fields (destination, date range, travel mode, budget, travel style, activity preferences) via `lib/validators.ts`; on validation failure return field-level errors; on success INSERT trip row; derive cache key; call `getOrGenerateAdviceAction` for all 15 categories; redirect to `/home/[tripId]`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 8.2 Build `app/(app)/trip/new/page.tsx` with `components/forms/TripForm.tsx`
    - Destination `<select>` from `DESTINATIONS` constant; date range pickers (start + end); travel mode radio/select; budget number input (min 1, max 1 000 000); travel style select; activity preferences multi-select checkboxes; field-level validation errors from Server Action; all inputs meet 44 × 44 px touch targets; single-column on < 600 px
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6, 10.1, 10.5_


- [x] 9. Home page — Concise Cards and Expanded Cards
  - [x] 9.1 Implement `components/cards/ConciseCard.tsx`
    - Accept `topic`, `summary`, `isLoading`, `isExpanded`, `onToggle` props; render loading placeholder (skeleton) while `isLoading`; render summary text when loaded; render card in collapsed/expanded states; tappable to toggle; minimum 44 × 44 px touch target
    - _Requirements: 5.1, 5.3, 5.5, 5.6, 10.5_

  - [ ]* 9.2 Write unit tests for `ConciseCard`
    - Test renders loading state, renders advice text, renders fallback text when summary generation fails; test toggle expand/collapse
    - _Requirements: 5.3, 5.5, 5.6_

  - [x] 9.3 Implement `components/cards/ExpandedCard.tsx`
    - Accept `category`, `adviceRecord`, `isLoading` props; render topic name, "Recommended?" indicator (Yes/No/Unknown), concise-view answer, and each sub-question with its AI-generated answer as labelled sections; display "Not applicable" for absent answers; show loading state per sub-question while advice is pending
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 9.4 Write property-based tests for `ExpandedCard` rendering
    - **Property 17: Expanded Card Renders All Required Fields**
    - **Validates: Requirements 6.1**
    - Random `AdviceRecord`; assert rendered output contains topic name, recommended indicator, concise answer, and labelled section for each sub-question

  - [x] 9.5 Build `app/(app)/home/[tripId]/page.tsx`
    - Server Component: fetch trip + all 15 advice records via `Advice_Store.getForTrip()`; derive 12 Concise Card topics; call `LLM_Adapter.summarise()` per card (streamed); render 12 `ConciseCard` components in responsive grid (≥ 2 columns at ≥ 600 px, single column below); include link to Comprehensive View; include "Add new destination" link
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_


- [x] 10. Checkpoint — Ensure all tests pass
  - Run `jest --passWithNoTests` and `tsc --noEmit`; verify trip creation → home page card rendering; ask the user if questions arise.

- [x] 11. Voting and experience notes
  - [x] 11.1 Implement `actions/vote.ts` Server Actions — `castVoteAction`, `changeVoteAction`, `retractVoteAction`, `addExperienceNoteAction`
    - `castVoteAction`: validate no existing vote → INSERT vote row; `changeVoteAction`: UPDATE existing vote row; `retractVoteAction`: DELETE vote row; `addExperienceNoteAction`: validate note length (1–500 chars) via `lib/validators.ts` → UPSERT vote row with `experience_note`; return confirmation or field-level error
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [ ]* 11.2 Write property-based tests for vote write round-trip
    - **Property 3: Vote Write Round-Trip**
    - **Validates: Requirements 7.2, 7.6**
    - Use `fc.tuple(fc.uuid(), fc.uuid(), fc.constantFrom('accurate','outdated'))`; assert vote row exists after cast with correct voteType

  - [ ]* 11.3 Write property-based tests for vote transition uniqueness
    - **Property 4: Vote Transition Preserves Uniqueness**
    - **Validates: Requirements 7.2, 7.6**
    - Use sequence of vote actions `fc.array(fc.constantFrom('accurate','outdated'), { minLength:1, maxLength:10 })`; assert `votes` row count for (userId, adviceId) pair is always ≤ 1 and final row equals last action

  - [ ]* 11.4 Write property-based tests for vote retraction
    - **Property 5: Vote Retraction Leaves No Residual Record**
    - **Validates: Requirements 7.7**
    - After casting any vote and then retracting, assert zero rows for (userId, adviceId) pair

  - [x] 11.5 Implement `components/voting/VoteButtons.tsx`
    - Render 👍 Accurate, 👎 Outdated, ➕ Add experience buttons; highlight user's current vote selection; clicking a selected vote retracts it; clicking ➕ opens an inline text input (max 500 chars, character counter, submit + cancel); all buttons meet 44 × 44 px touch targets; call appropriate Server Action on each interaction
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 10.5_

  - [ ]* 11.6 Write unit tests for `VoteButtons`
    - Test renders all three vote states (unvoted, 👍 selected, 👎 selected); test experience note input appears on ➕ click; test character-limit error at 501 chars
    - _Requirements: 7.1, 7.5, 7.8_

  - [x] 11.7 Wire `VoteButtons` into `ExpandedCard.tsx`
    - Render `VoteButtons` under each sub-question answer in the expanded card; pass current user vote state as props
    - _Requirements: 7.1, 7.5_


- [x] 12. Travel Destinations page
  - [x] 12.1 Build `app/(app)/destinations/page.tsx`
    - Server Component: query all trips for current user; split into "Upcoming destinations" (end_date ≥ today) and "Past destinations" (end_date < today); render each trip as a tappable row linking to `/home/[tripId]`; show empty-state message with link to `/trip/new` in each section when no trips exist; include "Add new destination" link
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 12.2 Write property-based tests for destination section categorisation
    - **Property 13: Trip Destination Section Categorisation**
    - **Validates: Requirements 8.1**
    - Use `fc.array(fc.record({ startDate: fc.date(), endDate: fc.date() }))` relative to today; assert each trip appears in exactly one section and in the correct section


- [x] 13. User Profile page
  - [x] 13.1 Build `app/(app)/profile/page.tsx`
    - Server Component: render current username (first + last name), profile image, editable username field, editable profile image upload, Terms & Conditions link, Logout button, Delete account button; hook all interactive elements to respective Server Actions
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 13.2 Implement delete account confirmation dialog in `components/ui/ConfirmDeleteModal.tsx`
    - Modal with warning message, "Confirm deletion" button, "Cancel" button; Cancel closes modal without deleting; Confirm triggers `deleteAccountAction`; on deletion failure show error message and return to profile page
    - _Requirements: 9.5, 9.6_

- [x] 14. App layout and navigation
  - [x] 14.1 Build `app/(app)/layout.tsx` — authenticated layout with nav
    - Auth guard (already enforced by middleware); bottom or side navigation linking to Home (active trip), Destinations, Profile; ensure all links and nav items meet 44 × 44 px touch targets; single-column on < 600 px
    - _Requirements: 5.7, 8.4, 10.1, 10.5_

  - [x] 14.2 Build shared primitive UI components in `components/ui/`
    - `Button.tsx`: variants (primary, secondary, destructive), disabled state, loading spinner; `Input.tsx`: label, error state, accessible aria attributes; `Modal.tsx`: focus trap, backdrop click to close, Escape key to close
    - _Requirements: 1.1, 2.5, 9.5, 10.2, 10.5_


- [x] 15. Checkpoint — Ensure all tests pass
  - Run `jest --passWithNoTests` and `tsc --noEmit`; verify full user flow (login → setup → create trip → home cards → vote → destinations → profile → logout); ask the user if questions arise.

- [x] 16. Responsive layout and accessibility polish
  - [x] 16.1 Audit and fix all pages for mobile-first responsive behaviour
    - Verify single-column layout at 375 px, ≥ 2 column card grid at ≥ 600 px; eliminate horizontal overflow at all viewport widths; use Tailwind `sm:` breakpoint for overrides
    - _Requirements: 5.2, 10.1, 10.4_

  - [ ]* 16.2 Write unit tests for responsive grid layout of Concise Cards
    - Test that card grid renders ≥ 2 columns at 600 px and exactly 1 column at 375 px using RTL with viewport mocking
    - _Requirements: 5.2, 10.1_

  - [x] 16.3 Audit and fix WCAG 2.1 AA colour contrast and touch target sizes across all pages
    - Check all text/background pairs meet 4.5:1 contrast ratio (normal text) or 3:1 (large text); verify all interactive elements have `min-h-[44px] min-w-[44px]`
    - _Requirements: 10.2, 10.5_

- [x] 17. Final checkpoint — Ensure all tests pass
  - Run `jest --passWithNoTests`, `tsc --noEmit`, verify no lint errors via `next lint`; ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; all property-based tests use `fast-check` and are tagged `// Feature: mvp-travel-reality, Property N:`
- All code is TypeScript; Server Components and Server Actions are the primary data-access pattern; Client Components are used only where interactivity is required
- Profile images are stored as file-path references in MVP; swap to S3/R2 post-MVP without schema change
- Budget tiers: $1–$99 → `budget`, $100–$499 → `mid`, $500–$1 000 000 → `luxury`
- The `citext` PostgreSQL extension must be enabled before running migrations (`CREATE EXTENSION IF NOT EXISTS citext`)
- Session cookies are HttpOnly, Secure, SameSite=Lax with a 24-hour expiry
- Drizzle migrations live in `db/migrations/`; run `drizzle-kit migrate` to apply


## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3"] },
    { "id": 2, "tasks": ["1.4", "1.5"] },
    { "id": 3, "tasks": ["2.1", "2.8"] },
    { "id": 4, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.9"] },
    { "id": 5, "tasks": ["4.1", "5.1"] },
    { "id": 6, "tasks": ["4.2", "4.3", "4.4", "5.2", "5.3"] },
    { "id": 7, "tasks": ["4.5", "5.4", "5.5"] },
    { "id": 8, "tasks": ["7.1"] },
    { "id": 9, "tasks": ["7.2", "7.3", "7.4"] },
    { "id": 10, "tasks": ["7.5", "8.1"] },
    { "id": 11, "tasks": ["8.2", "9.1"] },
    { "id": 12, "tasks": ["9.2", "9.3", "9.5"] },
    { "id": 13, "tasks": ["9.4", "11.1", "14.2"] },
    { "id": 14, "tasks": ["11.2", "11.3", "11.4", "11.5"] },
    { "id": 15, "tasks": ["11.6", "11.7", "12.1"] },
    { "id": 16, "tasks": ["12.2", "13.1"] },
    { "id": 17, "tasks": ["13.2", "14.1"] },
    { "id": 18, "tasks": ["16.1"] },
    { "id": 19, "tasks": ["16.2", "16.3"] }
  ]
}
```
