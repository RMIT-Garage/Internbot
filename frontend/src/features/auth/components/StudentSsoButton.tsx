'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { getAuthErrorMessage } from '@/lib/firebase/auth-errors'
import { getRedirectPath } from '@/features/auth/utils/redirect'

export function StudentSsoButton() {
  const router = useRouter()
  const { signInWithGoogle } = useAuth()
  const [submitting, setSubmitting] = useState(false)

  const onClick = async () => {
    setSubmitting(true)
    try {
      await signInWithGoogle()
      router.push(getRedirectPath())
    } catch (error) {
      console.error('[StudentSsoButton] sign-in failed:', error)
      toast.error(getAuthErrorMessage(error, 'Sign-in failed. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={submitting}
      className="bg-brand-500 hover:bg-brand-600 focus-visible:outline-brand-500 inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <LogIn aria-hidden="true" className="size-4" />
      {submitting ? 'Redirecting…' : 'Sign in with RMIT Student ID'}
      {!submitting && <ArrowRight aria-hidden="true" className="size-4" />}
    </button>
  )
}
