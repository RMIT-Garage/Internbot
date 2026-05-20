'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { isCoordinatorRole } from '@/lib/coordinator/auth'

export function useRequireCoordinatorAuth({ disabled = false } = {}): { ready: boolean } {
  const { user, profile, loading, needsVerification } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (disabled || loading) return

    if (!user) {
      const currentPath = getCurrentCoordinatorPath(pathname)
      const redirect = currentPath ? `?redirect=${encodeURIComponent(currentPath)}` : ''
      router.replace(`/login${redirect}`)
      return
    }

    if (needsVerification) {
      router.replace('/verify-email')
      return
    }

    if (profile && !isCoordinatorRole(profile.role)) {
      router.replace('/dashboard')
    }
  }, [user, profile, loading, needsVerification, router, pathname, disabled])

  return {
    ready: disabled || (!loading && !!user && !!profile && isCoordinatorRole(profile.role)),
  }
}

function getCurrentCoordinatorPath(pathname: string | null): string {
  if (typeof window === 'undefined') return withTrailingSlash(pathname ?? '')
  return `${withTrailingSlash(window.location.pathname)}${window.location.search}`
}

function withTrailingSlash(path: string): string {
  if (!path || path.endsWith('/')) return path
  return `${path}/`
}
