'use client'

import Link from 'next/link'
import { useRedirectIfAuthed } from '@/hooks/useRequireAuth'
import { AuthPageShell } from '@/features/auth/components/AuthPageShell'
import { EmailPasswordLoginForm } from '@/features/auth/components/EmailPasswordLoginForm'

export default function LoginPage() {
  useRedirectIfAuthed()

  return (
    <AuthPageShell>
      <div className="mb-6 space-y-2 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Sign in</h2>
        <p className="text-sm leading-6 text-zinc-500">
          Access your dashboard, manage internship progress, and track your placements.
        </p>
      </div>

      <EmailPasswordLoginForm
        idPrefix="login"
        emailLabel="Email"
        emailPlaceholder="you@rmit.edu.au"
        submitLabel="Sign in"
        showForgotPassword
      />
      <p className="mt-6 text-center text-xs text-zinc-500">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-medium text-red-600 hover:underline">
          Create one
        </Link>
      </p>
    </AuthPageShell>
  )
}
