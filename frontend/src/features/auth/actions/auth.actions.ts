'use server'
import { adminDb } from '@/lib/firebase/admin'
import { requireAuth } from '@/actions/auth.actions'
import { revalidatePath } from 'next/cache'
import type { CreateAuthInput, UpdateAuthInput } from '../types'

export async function createAuth(input: CreateAuthInput) {
  requireAuth()
  const docRef = adminDb.collection('auth').doc()
  await docRef.set({ ...input, createdAt: new Date(), updatedAt: new Date() })
  revalidatePath('/auth')
  return docRef.id
}

export async function updateAuth(id: string, input: UpdateAuthInput) {
  requireAuth()
  const docRef = adminDb.collection('auth').doc(id)
  await docRef.update({ ...input, updatedAt: new Date() })
  revalidatePath('/auth')
  return { success: true }
}

export async function deleteAuth(id: string) {
  requireAuth()
  const docRef = adminDb.collection('auth').doc(id)
  await docRef.delete()
  revalidatePath('/auth')
  return { success: true }
}
