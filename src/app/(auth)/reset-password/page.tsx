import { Suspense } from 'react'
import ResetPasswordForm from '@/components/forms/ResetPasswordForm'

export const metadata = {
  title: 'Reset Password – Travel Guide',
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
