'use client'

import Link from 'next/link'
import { useRedirectIfAuthed } from '@/hooks/useRequireAuth'
import { RegisterForm } from '@/features/auth/components/RegisterForm'

export default function RegisterPage() {
  useRedirectIfAuthed()

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10">
      <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200 sm:p-10">
        <div className="flex items-center justify-between gap-6">
          <div className="flex flex-1 items-center gap-3">
            <span className="text-[10px] font-bold tracking-[0.2em] text-red-600 uppercase">
              Step 01 of 02
            </span>
            <div className="relative h-0.5 flex-1 bg-zinc-200">
              <div className="absolute inset-y-0 left-0 w-1/2 bg-red-500" />
            </div>
          </div>
          <span className="text-[10px] font-bold tracking-[0.2em] text-zinc-500 uppercase">
            Account Creation
          </span>
        </div>

        <div className="mt-8 space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Join Internbot</h1>
          <p className="text-sm leading-6 text-zinc-500">
            Enter your RMIT student credentials to begin your AI-enhanced internship journey.
          </p>
        </div>

        <div className="mt-8">
          <RegisterForm />
        </div>

        <p className="mt-6 flex items-center justify-between text-sm text-zinc-500">
          <span>Already have an account?</span>
          <Link href="/login" className="font-medium text-red-600 hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}
