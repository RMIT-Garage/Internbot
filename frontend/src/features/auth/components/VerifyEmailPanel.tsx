'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { resendVerificationEmail } from '@/lib/firebase/auth'
import { auth } from '@/lib/firebase/client'
import { getAuthErrorMessage } from '@/lib/firebase/auth-errors'
import { getDefaultRedirectPath } from '@/features/auth/utils/redirect'

export function VerifyEmailPanel() {
  const router = useRouter()
  const { user, profile, loading, needsVerification, refreshProfile, signOut } = useAuth()
  const [resending, setResending] = useState(false)
  const [checking, setChecking] = useState(false)

  // If we already have a hydrated profile, the email is verified — bounce
  // to the dashboard.
  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (profile) {
      if (profile.role === 'student') {
        router.replace('/onboarding/personal')
      } else {
        router.replace(getDefaultRedirectPath(profile.role))
      }
    }
  }, [user, profile, loading, router])

  const onResend = async () => {
    if (resending) return
    setResending(true)
    try {
      await resendVerificationEmail()
      toast.success('Verification email sent. Check your inbox (and spam folder).')
    } catch (error) {
      console.error('[VerifyEmailPanel] resend failed:', error)
      toast.error(getAuthErrorMessage(error, 'Could not send verification email.'))
    } finally {
      setResending(false)
    }
  }

  const onRecheck = async () => {
    if (checking) return
    setChecking(true)
    try {
      // `reload` pulls the latest emailVerified flag from the IdP, then
      // we force-refresh the ID token so the next API call carries the
      // updated `email_verified` claim.
      await auth.currentUser?.reload()
      await auth.currentUser?.getIdToken(true)
      await refreshProfile()
      // The provider's needsVerification flag updates after refreshProfile
      // resolves; if it's still true, surface a toast.
      if (auth.currentUser && !auth.currentUser.emailVerified) {
        toast.error('Email is still unverified. Click the link in the email we sent you.')
      } else if (needsVerification) {
        toast.error('Verified, but we could not load your profile. Please try again.')
      } else {
        toast.success('Email verified. Redirecting…')
      }
    } catch (error) {
      console.error('[VerifyEmailPanel] recheck failed:', error)
      toast.error('Could not check verification status. Try again in a moment.')
    } finally {
      setChecking(false)
    }
  }

  const onUseDifferentAccount = async () => {
    try {
      await signOut()
    } finally {
      router.replace('/login')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200 sm:p-10">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-50">
          <Mail className="size-6 text-red-600" aria-hidden="true" />
        </div>
        <h1 className="mt-6 text-center text-2xl font-bold tracking-tight text-zinc-900">
          Verify your email
        </h1>
        <p className="mt-2 text-center text-sm leading-6 text-zinc-500">
          {user?.email
            ? `We sent a verification link to ${user.email}. Click the link, then come back here.`
            : 'We sent a verification link to your inbox. Click the link, then come back here.'}
        </p>

        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={onRecheck}
            disabled={checking}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-red-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            {checking ? 'Checking…' : "I've verified my email"}
          </button>

          <button
            type="button"
            onClick={onResend}
            disabled={resending}
            className="inline-flex w-full items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resending ? 'Sending…' : 'Resend verification email'}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-500">
          Wrong account?{' '}
          <button
            type="button"
            onClick={onUseDifferentAccount}
            className="font-medium text-red-600 hover:underline"
          >
            Sign out
          </button>
        </p>
      </div>
    </div>
  )
}
