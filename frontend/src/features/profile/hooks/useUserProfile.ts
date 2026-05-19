'use client'

import { useState, useEffect, useCallback } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import { apiFetch } from '@/lib/api/client'
import type { PlatformUser, UpdateProfilePayload } from '../types'

interface UseUserProfileResult {
  user: PlatformUser | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  updateProfile: (payload: UpdateProfilePayload) => Promise<void>
  saving: boolean
}

export function useUserProfile(): UseUserProfileResult {
  const [user, setUser] = useState<PlatformUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchUser = useCallback(async () => {
    try {
      setError(null)
      const data = await apiFetch<PlatformUser>('/api/v1/users/me')
      setUser(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Wait for Firebase to restore the session before fetching
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        fetchUser()
      } else {
        setLoading(false)
      }
    })
    return () => unsubscribe()
  }, [fetchUser])

  const updateProfile = useCallback(async (payload: UpdateProfilePayload) => {
    setSaving(true)
    setError(null)
    try {
      const updated = await apiFetch<PlatformUser>('/api/v1/users/me', {
        method: 'PATCH',
        body: payload,
      })
      setUser(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
      throw err
    } finally {
      setSaving(false)
    }
  }, [])

  return { user, loading, error, refresh: fetchUser, updateProfile, saving }
}
