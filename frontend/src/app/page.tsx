'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { getDefaultRedirectPath } from '@/features/auth/utils/redirect'

// Static export has no server-side redirect, so we bounce on the client.
// Signed-in + verified → role-aware dashboard. Signed-in + unverified → /verify-email.
// Signed-out → /login (the actual welcome screen with Student/Staff tabs).
//
// This component also runs when Firebase Hosting's catch-all rewrite serves
// /index.html for an unknown deep-link path (e.g. /coordinator/semesters/id/students).
// In that case we redirect back to the intended path so the App Router can render
// the correct component, rather than bouncing blindly to the role dashboard.
export default function LandingPage() {
  const router = useRouter()
  const { user, profile, loading, needsVerification } = useAuth()

  useEffect(() => {
    if (loading) return

    const intendedPath =
      typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/'
    const isRoot = intendedPath === '/' || intendedPath === ''

    if (!user) {
      const redirect = !isRoot ? `?redirect=${encodeURIComponent(intendedPath)}` : ''
      router.replace(`/login${redirect}`)
      return
    }
    if (needsVerification) {
      router.replace('/verify-email')
      return
    }
    if (profile) {
      // Deep-link catch-all: let the App Router navigate to the intended page.
      // Root path: send to the role-appropriate dashboard as normal.
      router.replace(isRoot ? getDefaultRedirectPath(profile.role) : intendedPath)
    }
  }, [user, profile, loading, needsVerification, router])

  return null
}
