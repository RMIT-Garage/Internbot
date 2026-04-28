'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from './useAuth'

export function useRequireAuth(): { ready: boolean } {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return
    if (!user) {
      const redirect = pathname ? `?redirect=${encodeURIComponent(pathname)}` : ''
      router.replace(`/login${redirect}`)
    }
  }, [user, loading, router, pathname])

  return { ready: !loading && !!user }
}

export function useRedirectIfAuthed(target = '/dashboard'): { ready: boolean } {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (user) router.replace(target)
  }, [user, loading, router, target])

  return { ready: !loading && !user }
}
