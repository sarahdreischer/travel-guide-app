# Design Document: User Registration

## Overview

User Registration enables first-time visitors to create an account from the login page by navigating to the existing setup flow. This is a small wiring feature: the setup form (`SetupForm`) and profile action (`setupProfileAction`) already handle user creation, password hashing, and session establishment. The design focuses on:

1. Adding a "Sign up" link to the login page
2. Allowing unauthenticated access to `/setup` via middleware changes
3. Redirecting already-setup users away from `/setup`
4. Hiding the profile image upload during registration
5. Detecting duplicate emails in `setupProfileAction`
6. Setting the `setup_complete` cookie on successful registration

The total scope is approximately 5 files changed with minimal new logic.

---

## Architecture

The feature slots into the existing authentication/setup architecture without new services or database changes.

```mermaid
flowchart TD
    A[Guest visits /login] --> B{Has account?}
    B -- Yes --> C[Enter credentials → loginAction]
    B -- No --> D[Click "Sign up" link]
    D --> E[Navigate to /setup]
    E --> F[Middleware: allow /setup without session]
    F --> G[SetupForm renders without profile image field]
    G --> H[Guest fills form + acknowledges disclaimer]
    H --> I[setupProfileAction]
    I --> J{Email already exists?}
    J -- Yes --> K[Return field-level error]
    J -- No --> L[Create user + session]
    L --> M[Set session_token + setup_complete cookies]
    M --> N[Redirect to /home]
```

### Request Flow for Registration

1. Guest lands on `/login` → sees "Sign up" link below the login button
2. Guest clicks link → browser navigates to `/setup`
3. Middleware sees `/setup` in its exclusion list → passes through without requiring `session_token`
4. If the request has both `session_token` and `setup_complete` cookies → redirect to `/home` (prevents re-registration)
5. `SetupForm` renders without the profile image field (prop-controlled)
6. Guest submits form → `setupProfileAction` validates, checks for duplicate email, creates user, creates session, sets both cookies, redirects to `/home`

---

## Components and Interfaces

### 1. Login Page (`src/app/(auth)/login/page.tsx`)

**Change:** Add a "Sign up" link below the `<LoginForm />` component.

```tsx
<p className="text-center text-sm text-gray-600">
  Don&apos;t have an account?{' '}
  <a href="/setup" className="font-medium text-blue-600 hover:text-blue-500 inline-block min-h-[44px] min-w-[44px] leading-[44px]">
    Sign up
  </a>
</p>
```

The link uses a standard `<a>` tag (not `next/link`) since `/setup` is in a different route group. It meets the 44×44 px touch target via min-height/min-width and has accessible text.

### 2. Middleware (`src/middleware.ts`)

**Changes:**

- Add `/setup` to the matcher so middleware can intercept requests to it
- For `/setup` specifically: if no session → allow through (do nothing); if session exists AND `setup_complete` is "true" → redirect to `/home`; if session exists but no `setup_complete` → allow through (user is mid-setup)

Updated logic:

```typescript
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionToken = request.cookies.get("session_token")
  const setupComplete = request.cookies.get("setup_complete")

  // Special handling for /setup route
  if (pathname === "/setup") {
    // Already authenticated + setup done → redirect away
    if (sessionToken?.value && setupComplete?.value === "true") {
      return NextResponse.redirect(new URL("/home", request.url))
    }
    // Otherwise allow access (guest registering, or user mid-setup)
    return NextResponse.next()
  }

  // All other matched routes: require session + setup_complete
  if (!sessionToken?.value) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  if (!setupComplete?.value || setupComplete.value !== "true") {
    return NextResponse.redirect(new URL("/setup", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/home/:path*",
    "/destinations/:path*",
    "/trip/:path*",
    "/profile/:path*",
    "/setup",
  ],
}
```

### 3. SetupForm (`src/components/forms/SetupForm.tsx`)

**Change:** Accept an optional `showProfileImage` prop (default `true`). When `false`, the profile image field is not rendered.

```typescript
interface SetupFormProps {
  showProfileImage?: boolean
}

export default function SetupForm({ showProfileImage = true }: SetupFormProps) {
  // ... existing code ...
  // Conditionally render profile image field:
  {showProfileImage && (
    <div>/* profile image input */</div>
  )}
}
```

The setup page passes `showProfileImage={false}` during registration. The existing profile page (if it ever reuses this form) can pass `true` or omit the prop.

### 4. Setup Page (`src/app/(setup)/setup/page.tsx`)

**Change:** Pass `showProfileImage={false}` to `SetupForm`.

```tsx
<SetupForm showProfileImage={false} />
```

### 5. `setupProfileAction` (`src/actions/profile.ts`)

**Changes:**

1. **Duplicate email detection:** Before calling `ProfileService.create()`, query the database for an existing user with the same email. If found, return a field-level error.
2. **Set `setup_complete` cookie:** After successful profile creation and session establishment, set the `setup_complete` cookie alongside `session_token`.

```typescript
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'

// ... inside setupProfileAction, after validation passes:

// Check for duplicate email
const [existingUser] = await db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.email, email))
  .limit(1)

if (existingUser) {
  return {
    success: false,
    errors: { email: 'An account with this email already exists.' },
  }
}

// ... after successful login:
if (loginResult.success) {
  const cookieStore = await cookies()
  cookieStore.set('session_token', loginResult.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: loginResult.expiresAt,
  })
  cookieStore.set('setup_complete', 'true', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: loginResult.expiresAt,
  })
}
```

The `setup_complete` cookie is NOT httpOnly because the middleware (Edge Runtime) reads it via `request.cookies`. It has the same expiry as the session token.

---

## Data Models

No database schema changes are required. The existing `users` table already has:
- A unique constraint on `email` (database-level protection against duplicates)
- `setupComplete` boolean field
- All fields needed for registration (firstName, lastName, email, passwordHash, profileImagePath)

The duplicate email check in `setupProfileAction` provides a user-friendly error message before hitting the DB constraint. The database constraint remains as a safety net for race conditions.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Duplicate email rejection

*For any* email address that already exists in the users table, calling `setupProfileAction` with that email SHALL return `{ success: false }` with an `email` field error, and the total number of users in the database SHALL remain unchanged.

**Validates: Requirements 3.2**

### Property 2: Image validation correctness

*For any* file metadata with a MIME type not in `{image/jpeg, image/png, image/webp}` OR a size exceeding 5 MB, the `ProfileService.validateImage()` function SHALL return `{ valid: false }` with an appropriate error code.

**Validates: Requirements 4.3**

---

## Error Handling

| Scenario | Handling | User Feedback |
|----------|----------|---------------|
| Duplicate email on registration | `setupProfileAction` checks DB before insert | Field-level error: "An account with this email already exists." |
| Database unique constraint violation (race condition) | Catch Postgres error code `23505` in `ProfileService.create()` | Return same field-level error as above |
| Invalid form fields (empty name, bad email format) | Existing client-side + server-side validation | Field-level errors on respective fields |
| Invalid profile image (wrong format/too large) | `ProfileService.validateImage()` | Field-level error on profileImage field |
| Session creation failure after profile creation | Unlikely but handled — user can log in manually | Redirect to /login; user can authenticate with new credentials |

### Race Condition Handling

A race condition can occur if two requests attempt to register with the same email simultaneously. Both pass the `SELECT` check, but the second `INSERT` violates the unique constraint. The design handles this by:
1. Catching the PostgreSQL unique violation error (code `23505`) in `ProfileService.create()`
2. Returning a user-friendly duplicate email error instead of a 500

---

## Testing Strategy

### Unit Tests (Jest + React Testing Library)

- **Login page:** Verify "Sign up" link renders with correct href, text, and accessibility attributes
- **SetupForm:** Verify profile image field is hidden when `showProfileImage={false}`
- **SetupForm:** Verify profile image field is shown when `showProfileImage={true}` (default)
- **setupProfileAction:** Verify duplicate email returns field-level error (mocked DB)
- **setupProfileAction:** Verify `setup_complete` cookie is set on success (mocked DB + cookies)

### Property-Based Tests (fast-check)

The project already has `fast-check` (v3.23.2) installed.

- **Property 1:** Generate random email strings (valid format), insert a user record into a mocked store, then call the duplicate-check logic with the same email. Assert it always returns an error and does not insert a second record.
  - Minimum 100 iterations
  - Tag: `Feature: user-registration, Property 1: Duplicate email rejection`

- **Property 2:** Generate random MIME types (from both valid and invalid sets) and random file sizes (0 to 10 MB). Assert `validateProfileImage` correctly accepts valid combinations and rejects invalid ones.
  - Minimum 100 iterations
  - Tag: `Feature: user-registration, Property 2: Image validation correctness`

### Integration Tests

- **Middleware:** Test that `/setup` is accessible without session, and redirects to `/home` when session + setup_complete cookies are present
- **End-to-end registration flow:** Submit valid form data, verify user creation + session + cookies + redirect

### What Is NOT Property-Tested

- UI rendering (link existence, styling, positioning) → example-based RTL tests
- Middleware routing logic → integration tests with 2-3 scenarios
- Cookie setting → integration test verifying presence after action completes
- Navigation behavior → example-based test
