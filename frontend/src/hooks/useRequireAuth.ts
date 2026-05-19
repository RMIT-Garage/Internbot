'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from './useAuth'

/**
 * Gate for protected pages: bounces to /login if signed out and to
 * /verify-email if signed in but the backend won't mint a platform user
 * yet (email not verified).
 */
export function useRequireAuth(): { ready: boolean } {
  const { user, profile, loading, needsVerification } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return
    if (!user) {
      const redirect = pathname ? `?redirect=${encodeURIComponent(pathname)}` : ''
      router.replace(`/login${redirect}`)
      return
    }
    if (needsVerification) {
      router.replace('/verify-email')
    }
  }, [user, profile, loading, needsVerification, router, pathname])

  return { ready: !loading && !!user && !!profile }
}

/**
 * Used by /login and /register: bounces to the dashboard once a fully
 * provisioned profile is available, or to /verify-email if Firebase has
 * a session but the email is still unverified.
 */
export function useRedirectIfAuthed(target = '/dashboard'): { ready: boolean } {
  const { user, profile, loading, needsVerification } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) return
    if (needsVerification) {
      router.replace('/verify-email')
      return
    }
    if (profile) {
      router.replace(target)
    }
  }, [user, profile, loading, needsVerification, router, target])

  return { ready: !loading && !user }
}
