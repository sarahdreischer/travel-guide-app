# Requirements Document

## Introduction

User Registration enables first-time visitors to create an account in MVPTravel Reality directly from the login page. The feature provides a clear navigation path from the existing login page to the existing new-user setup flow, which already handles profile creation, password hashing, session establishment, and redirection to the Home page. The scope is primarily a UI wiring change: adding a visible "Sign up" call-to-action on the login page and ensuring the setup page is accessible to unauthenticated visitors.

---

## Glossary

- **System**: The MVPTravel Reality web application (Next.js frontend + backend).
- **Guest**: An unauthenticated visitor who has not yet created an account or logged in.
- **Login_Page**: The page at `/login` that contains the email/password login form.
- **Setup_Page**: The page at `/setup` that contains the new-user profile setup form (first name, last name, email, password, profile image, liability disclaimer).
- **Registration_Link**: A visible navigation element on the Login_Page that directs the Guest to the Setup_Page.
- **Middleware**: The Next.js middleware that guards authenticated routes by checking for session and setup cookies.

---

## Requirements

### Requirement 1: Registration Navigation from Login Page

**User Story:** As a Guest, I want to see a clear "Sign up" option on the login page, so that I can navigate to the registration flow when I do not have existing credentials.

#### Acceptance Criteria

1. THE Login_Page SHALL display a Registration_Link below the login form containing the text "Sign up" or "Register" that navigates to the Setup_Page at the `/setup` route.
2. THE Registration_Link SHALL be visually distinct from the login form fields and positioned after the Login button, so that a Guest can identify the registration option without confusion.
3. WHEN a Guest clicks or taps the Registration_Link, THE System SHALL navigate the Guest to the Setup_Page without requiring authentication.
4. THE Registration_Link SHALL meet the minimum touch target size of 44 × 44 px on mobile viewports.
5. THE Registration_Link SHALL include accessible link text that clearly communicates the navigation destination to screen reader users.

---

### Requirement 2: Unauthenticated Access to Setup Page

**User Story:** As a Guest, I want to access the new-user setup page without being logged in, so that I can create my account for the first time.

#### Acceptance Criteria

1. WHEN a Guest navigates to the Setup_Page at `/setup` without an active session token, THE Middleware SHALL allow access to the Setup_Page without redirecting to the Login_Page.
2. WHILE a Guest is on the Setup_Page, THE System SHALL render the setup form including first name, last name, email, password, and liability disclaimer modal, but SHALL NOT display the profile image upload field.
3. WHEN an authenticated User who has already completed setup navigates to the Setup_Page, THE System SHALL redirect the User to the Home page to prevent duplicate account creation.

---

### Requirement 3: Registration Completes via Existing Setup Flow

**User Story:** As a Guest, I want the registration process to use the existing setup form, so that I can provide my profile information, set a password, and acknowledge the liability disclaimer in a single step.

#### Acceptance Criteria

1. WHEN a Guest submits the Setup_Page form with valid data and acknowledges the liability disclaimer, THE System SHALL create the user profile, hash the password with bcrypt (cost factor 12), create a session, and redirect the Guest (now authenticated User) to the Home page.
2. IF a Guest submits the Setup_Page form with an email address that is already associated with an existing account, THEN THE System SHALL display a field-level validation error on the email field indicating that the email is already in use, and SHALL NOT create a duplicate account.
3. WHEN the registration process completes successfully, THE System SHALL set the `session_token` cookie and the `setup_complete` cookie so that the Middleware grants access to authenticated routes.

---

### Requirement 4: Profile Image Upload After Registration

**User Story:** As a registered User, I want to upload a profile image from my profile settings page after I have created my account, so that I can personalise my profile at my own pace.

#### Acceptance Criteria

1. THE Setup_Page SHALL NOT include a profile image upload field during initial registration.
2. WHEN an authenticated User navigates to the Profile page, THE System SHALL display an option to upload or change a profile image.
3. WHERE a User uploads a profile image from the Profile page, THE Profile_Service SHALL accept images in JPEG, PNG, or WebP format with a maximum file size of 5 MB; IF the uploaded file does not meet these constraints, THEN THE Profile_Service SHALL display a field-level validation error and SHALL NOT save the file.

