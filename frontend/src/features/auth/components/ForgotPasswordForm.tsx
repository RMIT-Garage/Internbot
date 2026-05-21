'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { resetPassword } from '@/lib/firebase/auth'
import { resetPasswordSchema, type ResetPasswordInput } from '@/lib/validations/auth'
import { getAuthErrorMessage, getFirebaseErrorCode } from '@/lib/firebase/auth-errors'

export function ForgotPasswordForm() {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) })

  const onSubmit = async (data: ResetPasswordInput) => {
    try {
      await resetPassword(data.email)
      setSubmittedEmail(data.email)
      toast.success('If an account with that email exists, a reset link is on its way.')
    } catch (error) {
      // To avoid email enumeration, treat user-not-found as success.
      if (getFirebaseErrorCode(error) === 'auth/user-not-found') {
        setSubmittedEmail(data.email)
        toast.success('If an account with that email exists, a reset link is on its way.')
        return
      }
      console.error('[ForgotPasswordForm] reset failed:', error)
      toast.error(getAuthErrorMessage(error, 'Could not send reset email. Try again.'))
    }
  }

  if (submittedEmail) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-50">
          <Mail className="size-6 text-red-600" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-zinc-900">Check your inbox</h2>
          <p className="text-sm leading-6 text-zinc-500">
            If an account exists for <span className="font-medium">{submittedEmail}</span>, we sent
            a password-reset link. The link expires in one hour.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700"
        >
          <ArrowLeft aria-hidden="true" className="size-4" /> Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="space-y-1.5">
        <label
          htmlFor="reset-email"
          className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase"
        >
          Email
        </label>
        <div className="relative">
          <Mail
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400"
          />
          <input
            id="reset-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={errors.email ? 'true' : 'false'}
            className="block w-full rounded-md border border-zinc-300 bg-white py-2.5 pr-3 pl-9 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"
            {...register('email')}
          />
        </div>
        {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center rounded-md bg-red-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Sending…' : 'Send reset link'}
      </button>

      <Link
        href="/login"
        className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Back to sign in
      </Link>
    </form>
  )
}
