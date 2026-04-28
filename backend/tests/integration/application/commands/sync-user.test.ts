import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { SyncUserCommandHandler } from '../../../../src/application/commands/sync-user'
import { FirestoreUnitOfWork } from '../../../../src/infrastructure/firestore/firestore-unit-of-work'
import { FirebasePlatformClaimsService } from '../../../../src/infrastructure/services/firebase-platform-claims-service'
import { firestoreIdGenerator } from '../../../../src/infrastructure/firestore/firestore-id-generator'
import {
  initEmulator,
  clearDocs,
  clearAuthUsers,
  trackDoc,
  ensureFirebaseUser,
} from '../../../setup.emulator'
import { adminDb, adminAuth } from '../../../../src/infrastructure/config/firebase-admin'
import type { RequestActor } from '../../../../src/application/actor'

async function buildFreshActor(): Promise<RequestActor> {
  const firebaseUid = `fb_${randomUUID()}`
  const email = `${randomUUID().slice(0, 8)}@student.rmit.edu.au`
  await ensureFirebaseUser(firebaseUid, email)
  return { firebaseUid, email, platformUser: null }
}

describe('SyncUserCommandHandler — integration', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
    await clearAuthUsers()
  })

  it('first call creates a user doc with role=student, profileStatus=incomplete, and writes real Firebase custom claims', async () => {
    const actor = await buildFreshActor()
    const handler = new SyncUserCommandHandler(
      new FirestoreUnitOfWork(),
      new FirebasePlatformClaimsService(),
      firestoreIdGenerator
    )

    const result = await handler.handle({
      actor,
      studentNumber: `s${Math.floor(Math.random() * 1e9)}`,
      displayName: 'Alex Chen',
    })

    trackDoc('users', result.id)
    expect(result.created).toBe(true)

    const snap = await adminDb.collection('users').doc(result.id).get()
    const data = snap.data()
    expect(data?.['role']).toBe('student')
    expect(data?.['firebaseUid']).toBeUndefined()
    expect(data?.['studentProfile']?.['profileStatus']).toBe('incomplete')
    // Identity is denormalised onto the user doc — single read populates it.
    expect(data?.['identity']).toMatchObject({
      provider: 'firebase',
      providerUserId: actor.firebaseUid,
      emailSnapshot: actor.email,
    })

    // Slim sentinel — uniqueness lock only, just the back-pointer.
    const sentinel = await adminDb
      .collection('userIdentities')
      .doc(`firebase__${encodeURIComponent(actor.firebaseUid)}`)
      .get()
    expect(sentinel.data()).toMatchObject({ userId: result.id })

    // Real Firebase Auth claims must now be set on the emulator user.
    const authRecord = await adminAuth.getUser(actor.firebaseUid)
    expect(authRecord.customClaims).toEqual({ platformUserId: result.id, role: 'student' })
  })

  it('second call for the same firebaseUid returns created=false with the same id and updates displayName', async () => {
    const actor = await buildFreshActor()
    const handler = new SyncUserCommandHandler(
      new FirestoreUnitOfWork(),
      new FirebasePlatformClaimsService(),
      firestoreIdGenerator
    )

    const first = await handler.handle({
      actor,
      studentNumber: `s${Math.floor(Math.random() * 1e9)}`,
      displayName: 'Alex',
    })
    trackDoc('users', first.id)

    const second = await handler.handle({
      actor: { ...actor, platformUser: { id: first.id, role: 'student' } },
      studentNumber: undefined,
      displayName: 'Alex Updated',
    })

    expect(second.created).toBe(false)
    expect(second.id).toBe(first.id)

    const snap = await adminDb.collection('users').doc(first.id).get()
    expect(snap.data()?.['displayName']).toBe('Alex Updated')
  })

  it('first sync without studentNumber throws ValidationError with missing_required_field', async () => {
    const actor = await buildFreshActor()
    const handler = new SyncUserCommandHandler(
      new FirestoreUnitOfWork(),
      new FirebasePlatformClaimsService(),
      firestoreIdGenerator
    )

    await expect(
      handler.handle({ actor, studentNumber: undefined, displayName: undefined })
    ).rejects.toMatchObject({ name: 'ValidationError', reason: 'missing_required_field' })
  })
})
