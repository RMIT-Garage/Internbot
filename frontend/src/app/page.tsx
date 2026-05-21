'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { getDefaultRedirectPath } from '@/features/auth/utils/redirect'

// Static export has no server-side redirect, so we bounce on the client.
// Signed-in + verified → role-aware dashboard. Signed-in + unverified → /verify-email.
// Signed-out → /login (the actual welcome screen with Student/Staff tabs).
export default function LandingPage() {
  const router = useRouter()
  const { user, profile, loading, needsVerification } = useAuth()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (needsVerification) {
      router.replace('/verify-email')
      return
    }
    if (profile) {
      router.replace(getDefaultRedirectPath(profile.role))
    }
  }, [user, profile, loading, needsVerification, router])

  return null
}
