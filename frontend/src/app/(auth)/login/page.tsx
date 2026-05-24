'use client'

import Link from 'next/link'
import { useRedirectIfAuthed } from '@/hooks/useRequireAuth'
import { AuthLogo } from '@/features/auth/components/AuthLogo'
import { EmailPasswordLoginForm } from '@/features/auth/components/EmailPasswordLoginForm'

export default function LoginPage() {
  useRedirectIfAuthed()

  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden bg-zinc-950 text-white">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[url('/login-bg.jpg')] bg-cover bg-center contrast-110 grayscale-[10%]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-br from-black/50 to-black/70"
      />

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Welcome to Internbot
            </h1>
            <p className="text-[11px] font-semibold tracking-[0.25em] text-zinc-300 uppercase">
              Institutional Internship Portal
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 text-zinc-900 shadow-2xl ring-1 ring-black/5 sm:p-8">
            <div className="flex flex-col items-center gap-2">
              <AuthLogo />
              <p className="text-center text-sm leading-6 text-zinc-500">
                Sign in to access your dashboard, manage internship progress, and track your
                placements.
              </p>
            </div>

            <div className="mt-6 space-y-6">
              <EmailPasswordLoginForm
                idPrefix="login"
                emailLabel="Email"
                emailPlaceholder="you@rmit.edu.au"
                submitLabel="Sign in"
                showForgotPassword
              />
              <p className="text-center text-xs text-zinc-500">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="font-medium text-red-600 hover:underline">
                  Create one
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
