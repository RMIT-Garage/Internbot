import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { CreateSemesterCommandHandler } from '../../../../src/application/commands/create-semester'
import { UpdateSemesterCommandHandler } from '../../../../src/application/commands/update-semester'
import { GetSemesterQueryHandler } from '../../../../src/application/queries/get-semester'
import { FirestoreUnitOfWork } from '../../../../src/infrastructure/firestore/firestore-unit-of-work'
import { firestoreIdGenerator } from '../../../../src/infrastructure/firestore/firestore-id-generator'
import { initEmulator, clearDocs, trackDoc } from '../../../setup.emulator'
import type { RequestActor } from '../../../../src/application/actor'

function actorFor(role: 'student' | 'coordinator', id = `usr_${randomUUID()}`): RequestActor {
  return {
    firebaseUid: `fb_${randomUUID()}`,
    email: `${randomUUID().slice(0, 6)}@rmit.edu.au`,
    platformUser: { id, role },
  }
}

async function seedSemester(): Promise<{ id: string }> {
  const create = new CreateSemesterCommandHandler(new FirestoreUnitOfWork(), firestoreIdGenerator)
  const code = `2026-S${randomUUID()
    .slice(0, 8)
    .replace(/[^A-Za-z0-9]/g, 'a')}`
  const { id } = await create.handle({
    actor: actorFor('coordinator'),
    payload: {
      semesterCode: code,
      courseCode: 'INTE2710',
      displayName: 'Original',
      status: 'draft',
      enrolmentOpenAt: undefined,
      enrolmentCloseAt: undefined,
    },
  })
  trackDoc('semesters', id)
  return { id }
}

describe('UpdateSemesterCommandHandler — integration', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
  })

  it('coordinator can update displayName + enrolment window', async () => {
    const { id } = await seedSemester()
    const handler = new UpdateSemesterCommandHandler(new FirestoreUnitOfWork())
    const get = new GetSemesterQueryHandler(new FirestoreUnitOfWork())

    await handler.handle({
      actor: actorFor('coordinator'),
      semesterId: id,
      patch: {
        displayName: 'Renamed',
        enrolmentOpenAt: new Date('2026-01-15T00:00:00Z'),
        enrolmentCloseAt: new Date('2026-03-13T23:59:59Z'),
      },
    })

    const result = await get.handle({ actor: actorFor('coordinator'), semesterId: id })
    expect(result.semester.displayName).toBe('Renamed')
    expect(result.semester.enrolmentOpenAt?.toISOString()).toBe('2026-01-15T00:00:00.000Z')
    expect(result.semester.enrolmentCloseAt?.toISOString()).toBe('2026-03-13T23:59:59.000Z')
  })

  it('null patch on enrolment dates clears them', async () => {
    const { id } = await seedSemester()
    const handler = new UpdateSemesterCommandHandler(new FirestoreUnitOfWork())
    const get = new GetSemesterQueryHandler(new FirestoreUnitOfWork())

    await handler.handle({
      actor: actorFor('coordinator'),
      semesterId: id,
      patch: { enrolmentOpenAt: new Date('2026-01-15T00:00:00Z') },
    })

    await handler.handle({
      actor: actorFor('coordinator'),
      semesterId: id,
      patch: { enrolmentOpenAt: null },
    })

    const result = await get.handle({ actor: actorFor('coordinator'), semesterId: id })
    expect(result.semester.enrolmentOpenAt).toBeUndefined()
  })

  it('rejects non-coordinator actors with role_restricted_action', async () => {
    const { id } = await seedSemester()
    const handler = new UpdateSemesterCommandHandler(new FirestoreUnitOfWork())
    await expect(
      handler.handle({
        actor: actorFor('student'),
        semesterId: id,
        patch: { displayName: 'student-attempt' },
      })
    ).rejects.toMatchObject({ name: 'ForbiddenError', reason: 'role_restricted_action' })
  })

  it('stale expectedVersion throws PreconditionFailedError', async () => {
    const { id } = await seedSemester()
    const handler = new UpdateSemesterCommandHandler(new FirestoreUnitOfWork())
    await expect(
      handler.handle({
        actor: actorFor('coordinator'),
        semesterId: id,
        patch: { displayName: 'stale' },
        metadata: { expectedVersion: 0 },
      })
    ).rejects.toMatchObject({ name: 'PreconditionFailedError', reason: 'etag_mismatch' })
  })

  it('throws NotFoundError for unknown id', async () => {
    const handler = new UpdateSemesterCommandHandler(new FirestoreUnitOfWork())
    await expect(
      handler.handle({
        actor: actorFor('coordinator'),
        semesterId: `sem_${randomUUID()}`,
        patch: { displayName: 'ghost' },
      })
    ).rejects.toMatchObject({ name: 'NotFoundError' })
  })
})
