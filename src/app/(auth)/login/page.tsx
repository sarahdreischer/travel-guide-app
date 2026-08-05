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
        <p className="text-center text-sm text-gray-600">
          Don&apos;t have an account?{' '}
          <a
            href="/setup"
            className="font-medium text-blue-600 hover:text-blue-500 inline-block min-h-[44px] min-w-[44px] leading-[44px]"
          >
            Sign up
          </a>
        </p>
      </div>
    </main>
  )
}
