# Implementation Plan: User Registration

## Overview

Wire the existing setup flow into a self-service registration path accessible from the login page. The implementation modifies 5 existing files with minimal new logic: add a "Sign up" link, update middleware to allow unauthenticated access to `/setup`, hide the profile image field during registration, add duplicate email detection, and set the `setup_complete` cookie on successful registration.

## Tasks

- [x] 1. Add "Sign up" link to the login page
  - [x] 1.1 Add registration navigation link below LoginForm
    - In `src/app/(auth)/login/page.tsx`, add a paragraph with a "Sign up" link pointing to `/setup`
    - Use a standard `<a>` tag (cross route-group navigation)
    - Apply `min-h-[44px] min-w-[44px] leading-[44px] inline-block` for touch target compliance
    - Include surrounding text "Don't have an account?" for context
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 1.2 Write unit test for registration link
    - In `src/app/(auth)/login/page.test.tsx`, verify the link renders with correct `href="/setup"`, accessible text, and touch target classes
    - _Requirements: 1.1, 1.4, 1.5_

- [x] 2. Update middleware to allow unauthenticated access to /setup
  - [x] 2.1 Modify middleware routing logic for /setup
    - In `src/middleware.ts`, add `/setup` to the matcher config
    - Add special handling: if pathname is `/setup` and user has both `session_token` and `setup_complete=true`, redirect to `/home`
    - If pathname is `/setup` and no session or session without `setup_complete`, allow through with `NextResponse.next()`
    - Keep existing logic for all other matched routes unchanged
    - _Requirements: 2.1, 2.3_

  - [ ]* 2.2 Write unit tests for middleware /setup handling
    - Test: guest without session can access `/setup` (no redirect)
    - Test: user with `session_token` + `setup_complete=true` is redirected to `/home`
    - Test: user with `session_token` but no `setup_complete` can access `/setup`
    - _Requirements: 2.1, 2.3_

- [x] 3. Hide profile image field during registration
  - [x] 3.1 Add showProfileImage prop to SetupForm component
    - In `src/components/forms/SetupForm.tsx`, add `showProfileImage?: boolean` prop with default `true`
    - Wrap the profile image `<div>` with `{showProfileImage && (...)}`
    - _Requirements: 2.2, 4.1_

  - [x] 3.2 Pass showProfileImage={false} on the setup page
    - In `src/app/(setup)/setup/page.tsx`, pass `showProfileImage={false}` to `<SetupForm />`
    - _Requirements: 2.2, 4.1_

  - [ ]* 3.3 Write unit tests for SetupForm showProfileImage prop
    - Test: profile image field is hidden when `showProfileImage={false}`
    - Test: profile image field is shown when `showProfileImage={true}` (default)
    - _Requirements: 2.2, 4.1_

- [x] 4. Checkpoint - Verify UI changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Add duplicate email check and setup_complete cookie to setupProfileAction
  - [x] 5.1 Add duplicate email detection in setupProfileAction
    - In `src/actions/profile.ts`, import `eq` from `drizzle-orm` and `db`/`users` from the db layer
    - After field validation passes, query `db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)`
    - If a record is found, return `{ success: false, errors: { email: 'An account with this email already exists.' } }`
    - _Requirements: 3.2_

  - [x] 5.2 Set setup_complete cookie on successful registration
    - In `src/actions/profile.ts`, inside the `if (loginResult.success)` block, add a second `cookieStore.set('setup_complete', 'true', {...})` call
    - Use `httpOnly: false` (middleware Edge Runtime reads it), same `secure`, `sameSite`, `path`, and `expires` as the session token
    - _Requirements: 3.3_

  - [ ]* 5.3 Write property test for duplicate email rejection
    - **Property 1: Duplicate email rejection**
    - **Validates: Requirements 3.2**
    - Use fast-check to generate valid email strings, mock the DB to return an existing user, assert `setupProfileAction` returns `{ success: false }` with an `email` field error
    - Minimum 100 iterations

  - [ ]* 5.4 Write property test for image validation correctness
    - **Property 2: Image validation correctness**
    - **Validates: Requirements 4.3**
    - Use fast-check to generate random MIME types (valid + invalid) and random file sizes (0–10 MB)
    - Assert `ProfileService.validateImage()` returns `{ valid: false }` for invalid MIME types or sizes > 5 MB, and `{ valid: true }` for valid combinations
    - Minimum 100 iterations

  - [ ]* 5.5 Write unit tests for setupProfileAction changes
    - Test: duplicate email returns field-level error and does not create user
    - Test: successful registration sets both `session_token` and `setup_complete` cookies
    - _Requirements: 3.2, 3.3_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project already has `fast-check` v3.23.2 installed for property-based testing
- Jest + React Testing Library are the existing test tools

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1"] },
    { "id": 1, "tasks": ["1.2", "2.2", "3.2", "3.3"] },
    { "id": 2, "tasks": ["5.1", "5.2"] },
    { "id": 3, "tasks": ["5.3", "5.4", "5.5"] }
  ]
}
```
