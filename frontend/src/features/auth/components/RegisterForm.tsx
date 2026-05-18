'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Mail } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { registerSchema, STUDENT_EMAIL_DOMAIN, type RegisterInput } from '@/lib/validations/auth'
import { getAuthErrorMessage } from '@/lib/firebase/auth-errors'

export function RegisterForm() {
  const router = useRouter()
  const { signUpWithEmail } = useAuth()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) })

  const onSubmit = async (data: RegisterInput) => {
    const displayName = data.email.split('@')[0] ?? data.email
    try {
      await signUpWithEmail(data.email, data.password, displayName)
      toast.success('Account created — check your inbox to verify your email.')
      router.push('/verify-email')
    } catch (error) {
      console.error('[RegisterForm] sign-up failed:', error)
      toast.error(getAuthErrorMessage(error, 'Failed to create account. Please try again.'))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="space-y-1.5">
        <label
          htmlFor="institutional-email"
          className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
        >
          Institutional Email
        </label>
        <div className="relative">
          <input
            id="institutional-email"
            type="email"
            autoComplete="username"
            placeholder="s1234567@student.rmit.edu.au"
            aria-invalid={errors.email ? 'true' : 'false'}
            aria-describedby="institutional-email-hint"
            className="focus:border-brand-500 focus:ring-brand-500/20 block w-full rounded-md border border-zinc-300 bg-zinc-50 py-2.5 pl-3 pr-9 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2"
            {...register('email')}
          />
          <Mail
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
          />
        </div>
        <p id="institutional-email-hint" className="text-xs italic text-zinc-500">
          {errors.email ? (
            <span className="not-italic text-red-600">{errors.email.message}</span>
          ) : (
            <>Must be a valid {STUDENT_EMAIL_DOMAIN} address.</>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label
            htmlFor="register-password"
            className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
          >
            Password
          </label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={errors.password ? 'true' : 'false'}
            className="focus:border-brand-500 focus:ring-brand-500/20 block w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2"
            {...register('password')}
          />
          {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="register-confirm"
            className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
          >
            Confirm
          </label>
          <input
            id="register-confirm"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={errors.confirmPassword ? 'true' : 'false'}
            className="focus:border-brand-500 focus:ring-brand-500/20 block w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2"
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-red-600">{errors.confirmPassword.message}</p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-brand-500 hover:bg-brand-600 focus-visible:outline-brand-500 w-full rounded-md px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Creating account…' : 'Create Account'}
      </button>
    </form>
  )
}
