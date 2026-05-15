'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, LifeBuoy, ScrollText } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import {
  coordinatorPreviewEmail,
  coordinatorPreviewPassword,
  hasCoordinatorPreviewSession,
  isCoordinatorLoginPath,
  isCoordinatorPreviewCredentials,
  isCoordinatorPreviewEnabled,
  isCoordinatorRole,
  setCoordinatorPreviewSession,
} from '@/lib/coordinator/auth'

const coordinatorLoginSchema = z.object({
  identifier: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
})

type CoordinatorLoginInput = z.infer<typeof coordinatorLoginSchema>

const coordinatorAccessError = 'This account does not have coordinator access.'

function getCoordinatorRedirectTarget() {
  if (typeof window === 'undefined') {
    return '/coordinator/dashboard'
  }

  const redirect = new URLSearchParams(window.location.search).get('redirect')

  if (!redirect || !redirect.startsWith('/coordinator') || isCoordinatorLoginPath(redirect)) {
    return '/coordinator/dashboard'
  }

  return redirect
}

export default function CoordinatorLoginPage() {
  const router = useRouter()
  const { user, profile, loading, signInWithEmail, signOut } = useAuth()
  const [accessError, setAccessError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CoordinatorLoginInput>({
    resolver: zodResolver(coordinatorLoginSchema),
  })

  useEffect(() => {
    if (hasCoordinatorPreviewSession()) {
      router.replace(getCoordinatorRedirectTarget())
      return
    }
    if (loading || !user || !profile) return
    if (isCoordinatorRole(profile.role)) {
      router.replace(getCoordinatorRedirectTarget())
      return
    }
    void signOut()
    queueMicrotask(() => setAccessError(coordinatorAccessError))
  }, [user, profile, loading, router, signOut])

  const existingUserAccessError =
    !loading && user && profile && !isCoordinatorRole(profile.role) ? coordinatorAccessError : null
  const visibleAccessError = accessError ?? existingUserAccessError

  const onSubmit = async (data: CoordinatorLoginInput) => {
    setAccessError(null)
    const identifier = data.identifier.trim()

    if (isCoordinatorPreviewCredentials(identifier, data.password)) {
      // Development-only/demo-only: local coordinator preview, separate from Firebase/backend auth.
      setCoordinatorPreviewSession()
      router.push('/coordinator/dashboard')
      return
    }

    try {
      await signInWithEmail(identifier, data.password)
      setAccessError('Signing in. Checking coordinator access...')
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Invalid coordinator credentials or profile configuration.'
      setAccessError(message)
      toast.error(message)
    }
  }

  const handleDemoSignIn = async () => {
    // Development-only/demo-only: explicit local preview path, separate from real Firebase credentials.
    setCoordinatorPreviewSession()
    router.push('/coordinator/dashboard')
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-4 py-8 text-white sm:px-6"
      style={{
        backgroundImage: "url('/RMIT_Image.jpg')",
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }}
    >
      <div className="absolute inset-0 bg-zinc-950/68 backdrop-blur-[2px]" />
      <div className="absolute inset-0 bg-gradient-to-br from-red-950/55 via-zinc-950/55 to-black/85" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/70 to-transparent" />

      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-lg border border-white/20 bg-white/12 p-6 shadow-2xl shadow-black/45 backdrop-blur-xl transition-transform duration-300 sm:p-8 md:hover:-translate-y-0.5">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-red-700 text-white shadow-lg ring-1 shadow-red-950/30 ring-white/20">
              <ScrollText className="h-7 w-7" />
            </div>
            <p className="mt-4 text-sm font-semibold tracking-[0.2em] text-red-100 uppercase">
              Internbot
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Staff Login</h1>
            <p className="mt-2 text-sm text-zinc-200">Access the administrative dashboard</p>
          </div>

          {visibleAccessError && (
            <div className="mt-6 rounded-md border border-red-300/40 bg-red-950/55 px-3 py-2 text-sm text-red-100 shadow-sm">
              {visibleAccessError}
            </div>
          )}

          {isCoordinatorPreviewEnabled() && (
            <div className="mt-6 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-xs text-zinc-300">
              <span className="font-semibold text-red-100">Local development preview mode</span>
              <span className="block sm:inline">
                {' '}
                Use {coordinatorPreviewEmail} / {coordinatorPreviewPassword}.
              </span>
              <button
                type="button"
                onClick={handleDemoSignIn}
                className="ml-2 font-semibold text-red-100 underline-offset-2 hover:text-white hover:underline"
              >
                Preview as coordinator
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5">
            <div className="space-y-2">
              <label htmlFor="identifier" className="text-sm font-medium text-zinc-100">
                Staff Email
              </label>
              <input
                id="identifier"
                type="text"
                autoComplete="username"
                className="h-11 w-full rounded-md border border-white/20 bg-white/[0.92] px-3 text-sm text-zinc-950 shadow-sm transition outline-none placeholder:text-zinc-500 hover:bg-white focus:border-red-300 focus:ring-2 focus:ring-red-400/70"
                placeholder="coordinator@rmit.edu.au"
                {...register('identifier')}
              />
              {errors.identifier && (
                <p className="text-xs text-red-500">{errors.identifier.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <label htmlFor="password" className="text-sm font-medium text-zinc-100">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-red-100 transition-colors hover:text-white"
                >
                  Forgot Password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="h-11 w-full rounded-md border border-white/20 bg-white/[0.92] px-3 text-sm text-zinc-950 shadow-sm transition outline-none placeholder:text-zinc-500 hover:bg-white focus:border-red-300 focus:ring-2 focus:ring-red-400/70"
                placeholder="Password"
                {...register('password')}
              />
              {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-red-700 px-4 text-sm font-semibold text-white shadow-lg shadow-red-950/30 transition-all hover:bg-red-800 hover:shadow-red-950/45 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                'Signing in...'
              ) : (
                <>
                  Sign in with Staff ID
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <Link
            href="mailto:support@internbot.local"
            className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-white/20 bg-white/10 px-4 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/15"
          >
            <LifeBuoy className="h-4 w-4" />
            Technical Support
          </Link>
        </div>

        <footer className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-zinc-300">
          <span>&copy; 2024 RMIT University</span>
          <Link href="/privacy" className="hover:text-white">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-white">
            Terms
          </Link>
        </footer>
      </div>
    </div>
  )
}
