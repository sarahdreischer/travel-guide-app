import LoginForm from '@/components/forms/LoginForm'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-[400px] space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="mt-1 text-sm text-gray-600">
            Log in to access your trips and travel advice.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
