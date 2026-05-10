'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import {
  signInWithEmail as fbSignInWithEmail,
  signUpWithEmail as fbSignUpWithEmail,
  signOut as fbSignOut,
} from '@/lib/firebase/auth'
import { fetchCurrentUser } from '@/features/auth/api/users'
import type { AuthContextValue } from '@/types/auth'
import type { UserResponse } from '@/types/api'

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserResponse | null>(null)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [loading, setLoading] = useState(true)

  const hydrateProfile = useCallback(async (firebaseUser: User | null) => {
    if (!firebaseUser) {
      setProfile(null)
      setNeedsVerification(false)
      return
    }
    // Force-refresh so a freshly-verified `email_verified` claim reaches
    // the backend on the very next call.
    await firebaseUser.getIdToken(true).catch(() => undefined)
    const result = await fetchCurrentUser()
    if (result.kind === 'ok') {
      setProfile(result.user)
      setNeedsVerification(false)
    } else if (result.kind === 'unverified') {
      setProfile(null)
      setNeedsVerification(true)
    } else {
      // 401 — Firebase says signed-in but token is rejected. Treat as no profile.
      setProfile(null)
      setNeedsVerification(false)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      try {
        await hydrateProfile(firebaseUser)
      } catch (error) {
        console.error('[AuthProvider] failed to hydrate profile:', error)
        setProfile(null)
        setNeedsVerification(false)
      } finally {
        setLoading(false)
      }
    })
    return () => unsubscribe()
  }, [hydrateProfile])

  const signInWithEmail = async (email: string, password: string) => {
    await fbSignInWithEmail(email, password)
  }

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    await fbSignUpWithEmail(email, password, displayName)
  }

  const signOut = async () => {
    await fbSignOut()
  }

  const refreshProfile = useCallback(async () => {
    await hydrateProfile(auth.currentUser)
  }, [hydrateProfile])

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        needsVerification,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}
