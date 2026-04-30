import type { Timestamp } from 'firebase/firestore'

export interface Auth {
  uid: string // user ID
  email: string // user email
  password: string // user password
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type CreateAuthInput = Omit<Auth, 'createdAt' | 'updatedAt'>
export type UpdateAuthInput = Partial<Omit<Auth, 'uid' | 'createdAt' | 'updatedAt'>>
