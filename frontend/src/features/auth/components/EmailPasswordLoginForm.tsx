'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Lock, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { loginSchema, type LoginInput } from '@/lib/validations/auth'
import { getAuthErrorMessage } from '@/lib/firebase/auth-errors'
import { getRedirectPath } from '@/features/auth/utils/redirect'
import { fetchCurrentUser } from '@/features/auth/api/users'

export interface EmailPasswordLoginFormProps {
  idPrefix: string
  emailLabel: string
  emailPlaceholder: string
  submitLabel: string
  showForgotPassword?: boolean
}

export function EmailPasswordLoginForm({
  idPrefix,
  emailLabel,
  emailPlaceholder,
  submitLabel,
  showForgotPassword = false,
}: EmailPasswordLoginFormProps) {
  const router = useRouter()
  const { signInWithEmail } = useAuth()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginInput) => {
    try {
      await signInWithEmail(data.email, data.password)
      const result = await fetchCurrentUser()
      if (result.kind === 'unverified') {
        router.push('/verify-email')
        return
      }
      router.push(getRedirectPath(undefined, result.kind === 'ok' ? result.user.role : undefined))
    } catch (error) {
      console.error('[EmailPasswordLoginForm] sign-in failed:', error)
      toast.error(getAuthErrorMessage(error, 'Email or password is incorrect.'))
    }
  }

  const emailId = `${idPrefix}-email`
  const passwordId = `${idPrefix}-password`

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label
          htmlFor={emailId}
          className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase"
        >
          {emailLabel}
        </label>
        <div className="relative">
          <Mail
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400"
          />
          <input
            id={emailId}
            type="email"
            autoComplete="username"
            placeholder={emailPlaceholder}
            aria-invalid={errors.email ? 'true' : 'false'}
            className="block w-full rounded-md border border-zinc-300 bg-white py-2.5 pr-3 pl-9 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"
            {...register('email')}
          />
        </div>
        {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor={passwordId}
            className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase"
          >
            Password
          </label>
          {showForgotPassword && (
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-red-600 hover:text-red-700"
            >
              Forgot Password?
            </Link>
          )}
        </div>
        <div className="relative">
          <Lock
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400"
          />
          <input
            id={passwordId}
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={errors.password ? 'true' : 'false'}
            className="block w-full rounded-md border border-zinc-300 bg-white py-2.5 pr-3 pl-9 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"
            {...register('password')}
          />
        </div>
        {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-red-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Signing in…' : submitLabel}
        {!isSubmitting && <ArrowRight aria-hidden="true" className="size-4" />}
      </button>
    </form>
  )
}
