'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import {
  hasCoordinatorPreviewSession,
  isCoordinatorLoginPath,
  isCoordinatorRole,
} from '@/lib/coordinator/auth'

export function useRequireCoordinatorAuth({ disabled = false } = {}): { ready: boolean } {
  const { user, profile, loading, needsVerification } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const hasPreviewSession = hasCoordinatorPreviewSession()

  useEffect(() => {
    if (disabled || loading || isCoordinatorLoginPath(pathname)) return

    if (hasPreviewSession) {
      return
    }

    if (!user) {
      const currentPath =
        typeof window === 'undefined'
          ? pathname
          : `${window.location.pathname}${window.location.search}`
      const redirect = currentPath ? `?redirect=${encodeURIComponent(currentPath)}` : ''
      router.replace(`/coordinator/login${redirect}`)
      return
    }

    if (needsVerification) {
      router.replace('/verify-email')
      return
    }

    if (profile && !isCoordinatorRole(profile.role)) {
      router.replace('/dashboard')
    }
  }, [user, profile, loading, needsVerification, router, pathname, disabled, hasPreviewSession])

  return {
    ready:
      disabled ||
      hasPreviewSession ||
      (!loading && !!user && !!profile && isCoordinatorRole(profile.role)),
  }
}
