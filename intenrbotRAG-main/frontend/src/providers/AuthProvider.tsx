'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import {
  signInWithEmail as fbSignInWithEmail,
  signUpWithEmail as fbSignUpWithEmail,
  signInWithGoogle as fbSignInWithGoogle,
  signOut as fbSignOut,
  getIdToken,
} from '@/lib/firebase/auth'
import type { AuthContextValue } from '@/types/auth'
import type { UserProfile } from '@/types/firestore'

const AuthContext = createContext<AuthContextValue | null>(null)

async function syncUserProfile(user: User): Promise<UserProfile> {
  const profileRef = doc(db, 'users', user.uid)
  const snap = await getDoc(profileRef)

  if (!snap.exists()) {
    const newProfile: Omit<UserProfile, 'createdAt' | 'updatedAt'> = {
      uid: user.uid,
      email: user.email ?? '',
      displayName: user.displayName,
      photoURL: user.photoURL,
      role: 'user',
      _schemaVersion: 1,
    }
    await setDoc(profileRef, {
      ...newProfile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    const createdSnap = await getDoc(profileRef)
    return createdSnap.data() as UserProfile
  }

  return snap.data() as UserProfile
}

async function setSessionCookie(): Promise<void> {
  const token = await getIdToken()
  if (!token) return
  const response = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'Failed to establish server session')
  }
}

async function clearSessionCookie(): Promise<void> {
  await fetch('/api/auth/session', { method: 'DELETE' })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          await syncAuthenticatedState(firebaseUser)
        } else {
          setUser(null)
          setProfile(null)
          await clearSessionCookie()
        }
      } catch (error) {
        console.error('Auth state sync failed:', error)
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  async function syncAuthenticatedState(firebaseUser: User): Promise<void> {
    setUser(firebaseUser)
    const userProfile = await syncUserProfile(firebaseUser)
    setProfile(userProfile)
    await setSessionCookie()
  }

  const signInWithEmail = async (email: string, password: string) => {
    const firebaseUser = await fbSignInWithEmail(email, password)
    await syncAuthenticatedState(firebaseUser)
  }

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    const firebaseUser = await fbSignUpWithEmail(email, password, displayName)
    await syncAuthenticatedState(firebaseUser)
  }

  const signInWithGoogle = async () => {
    const firebaseUser = await fbSignInWithGoogle()
    await syncAuthenticatedState(firebaseUser)
  }

  const signOut = async () => {
    await fbSignOut()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOut,
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
