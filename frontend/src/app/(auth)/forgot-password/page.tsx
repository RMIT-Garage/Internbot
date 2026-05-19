'use client'

import Link from 'next/link'
import { useRedirectIfAuthed } from '@/hooks/useRequireAuth'
import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm'

export default function ForgotPasswordPage() {
  useRedirectIfAuthed()

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200 sm:p-10">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Reset your password</h1>
          <p className="text-sm leading-6 text-zinc-500">
            Enter the email associated with your account and we&apos;ll send you a link to reset
            your password.
          </p>
        </div>

        <div className="mt-8">
          <ForgotPasswordForm />
        </div>

        <p className="mt-6 text-center text-xs text-zinc-500">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-brand-600 font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
