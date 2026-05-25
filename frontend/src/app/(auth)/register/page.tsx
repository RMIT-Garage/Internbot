'use client'

import Link from 'next/link'
import { useRedirectIfAuthed } from '@/hooks/useRequireAuth'
import { AuthPageShell } from '@/features/auth/components/AuthPageShell'
import { RegisterForm } from '@/features/auth/components/RegisterForm'

export default function RegisterPage() {
  useRedirectIfAuthed()

  return (
    <AuthPageShell maxWidth="xl">
      <div className="mb-6 space-y-2 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Sign up</h2>
        <p className="text-sm leading-6 text-zinc-500">
          Use your RMIT student email to get started with your internship journey.
        </p>
      </div>

      <RegisterForm />
      <p className="mt-6 text-center text-xs text-zinc-500">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-red-600 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthPageShell>
  )
}
