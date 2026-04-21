import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { GetUserQueryHandler } from '../../../../src/application/queries/get-user'
import { SyncUserCommandHandler } from '../../../../src/application/commands/sync-user'
import { FirestoreUnitOfWork } from '../../../../src/infrastructure/firestore/firestore-unit-of-work'
import { FirebasePlatformClaimsService } from '../../../../src/infrastructure/services/firebase-platform-claims-service'
import {
  initEmulator,
  clearDocs,
  clearAuthUsers,
  trackDoc,
  ensureFirebaseUser,
} from '../../../setup.emulator'
import type { RequestActor } from '../../../../src/application/actor'

async function seedStudent(): Promise<{ id: string; firebaseUid: string }> {
  const firebaseUid = `fb_${randomUUID()}`
  const email = `${randomUUID().slice(0, 8)}@student.rmit.edu.au`
  await ensureFirebaseUser(firebaseUid, email)
  const sync = new SyncUserCommandHandler(
    new FirestoreUnitOfWork(),
    new FirebasePlatformClaimsService()
  )
  const { id } = await sync.handle({
    actor: { firebaseUid, email, platformUser: null },
    studentNumber: `s${Math.floor(Math.random() * 1e9)}`,
    displayName: undefined,
  })
  trackDoc('users', id)
  return { id, firebaseUid }
}

function actorFor(id: string, role: 'student' | 'coordinator'): RequestActor {
  return {
    firebaseUid: `fb_${randomUUID()}`,
    email: 'a@b.com',
    platformUser: { id, role },
  }
}

describe('GetUserQueryHandler — integration', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
    await clearAuthUsers()
  })

  it('owner student reads their own record with a populated ETag', async () => {
    const student = await seedStudent()
    const handler = new GetUserQueryHandler(new FirestoreUnitOfWork())

    const result = await handler.handle({
      actor: actorFor(student.id, 'student'),
      userId: student.id,
    })

    expect(result.user.id).toBe(student.id)
    expect(result.user.role).toBe('student')
    expect(result.user.version).toBeGreaterThan(0)
  })

  it('coordinator reads any student', async () => {
    const student = await seedStudent()
    const handler = new GetUserQueryHandler(new FirestoreUnitOfWork())

    const result = await handler.handle({
      actor: actorFor(`usr_${randomUUID()}`, 'coordinator'),
      userId: student.id,
    })
    expect(result.user.id).toBe(student.id)
  })

  it('student reading another student throws ForbiddenError with student_not_owner', async () => {
    const owner = await seedStudent()
    const other = await seedStudent()
    const handler = new GetUserQueryHandler(new FirestoreUnitOfWork())

    await expect(
      handler.handle({ actor: actorFor(other.id, 'student'), userId: owner.id })
    ).rejects.toMatchObject({ name: 'ForbiddenError', reason: 'student_not_owner' })
  })

  it('throws NotFoundError when the user id does not exist', async () => {
    const handler = new GetUserQueryHandler(new FirestoreUnitOfWork())
    await expect(
      handler.handle({
        actor: actorFor('usr_ghost', 'coordinator'),
        userId: `usr_${randomUUID()}`,
      })
    ).rejects.toMatchObject({ name: 'NotFoundError' })
  })

  it('pre-sync actor (platformUser=null) is rejected with no_platform_user', async () => {
    const handler = new GetUserQueryHandler(new FirestoreUnitOfWork())
    const preSync: RequestActor = {
      firebaseUid: `fb_${randomUUID()}`,
      email: 'x@y.z',
      platformUser: null,
    }

    await expect(
      handler.handle({ actor: preSync, userId: 'usr_whatever' })
    ).rejects.toMatchObject({ name: 'ForbiddenError', reason: 'no_platform_user' })
  })
})
