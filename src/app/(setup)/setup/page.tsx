import SetupForm from "@/components/forms/SetupForm";

/**
 * New-user setup page — Server Component.
 * Renders the profile setup form in a centered layout.
 *
 * Requirements: 2.1, 2.2
 */
export default function SetupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-[500px]">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">
          Complete Your Profile
        </h1>
        <p className="text-sm text-gray-600 mb-8 text-center">
          Set up your account to get started with personalised travel advice.
        </p>
        <SetupForm showProfileImage={false} />
      </div>
    </main>
  );
}
