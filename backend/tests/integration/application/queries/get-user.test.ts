import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { GetUserQueryHandler } from '../../../../src/application/queries/get-user'
import { createPlatformUserHydrator } from '../../../../src/api/auth/platform-user-hydrator'
import { FirestoreUnitOfWork } from '../../../../src/infrastructure/firestore/firestore-unit-of-work'
import { firestoreIdGenerator } from '../../../../src/infrastructure/firestore/firestore-id-generator'
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
  const studentNumber = `s${Math.floor(Math.random() * 1e9)}`
  const email = `${studentNumber}@student.rmit.edu.au`
  await ensureFirebaseUser(firebaseUid, email)
  const hydrate = createPlatformUserHydrator(new FirestoreUnitOfWork(), firestoreIdGenerator)
  const platformUser = await hydrate({ firebaseUid, email, emailVerified: true })
  if (!platformUser) throw new Error('JIT bootstrap failed in test seed')
  trackDoc('users', platformUser.id)
  return { id: platformUser.id, firebaseUid }
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

  it('actor without platformUser (hydrator could not JIT) is rejected with no_platform_user', async () => {
    const handler = new GetUserQueryHandler(new FirestoreUnitOfWork())
    const unhydrated: RequestActor = {
      firebaseUid: `fb_${randomUUID()}`,
      email: 'x@y.z',
      platformUser: null,
    }

    await expect(
      handler.handle({ actor: unhydrated, userId: 'usr_whatever' })
    ).rejects.toMatchObject({
      name: 'ForbiddenError',
      reason: 'no_platform_user',
    })
  })
})
