import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { CreateSemesterCommandHandler } from '../../../../src/application/commands/create-semester'
import { FirestoreUnitOfWork } from '../../../../src/infrastructure/firestore/firestore-unit-of-work'
import { firestoreIdGenerator } from '../../../../src/infrastructure/firestore/firestore-id-generator'
import { defaultAuthorizationService } from '../../../../src/infrastructure/authorization/default-authorization-service'
import { initEmulator, clearDocs, trackDoc } from '../../../setup.emulator'
import { adminDb } from '../../../../src/infrastructure/config/firebase-admin'
import type { RequestActor } from '../../../../src/application/actor'

function actorFor(role: 'student' | 'coordinator'): RequestActor {
  return {
    firebaseUid: `fb_${randomUUID()}`,
    email: `${randomUUID().slice(0, 6)}@rmit.edu.au`,
    platformUser: { id: `usr_${randomUUID()}`, role },
  }
}

function uniqueSemesterCode(): string {
  // Letters-only suffix keeps the platform-format regex happy.
  return `2026-S${randomUUID()
    .slice(0, 8)
    .replace(/[^A-Za-z0-9]/g, 'a')}`
}

describe('CreateSemesterCommandHandler — integration', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
  })

  it('coordinator with valid payload creates a semester doc', async () => {
    const handler = new CreateSemesterCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService,
      firestoreIdGenerator
    )
    const code = uniqueSemesterCode()

    const { id } = await handler.handle({
      actor: actorFor('coordinator'),
      payload: {
        semesterCode: code,
        courseCode: 'INTE2710',
        displayName: 'Test Semester',
        status: 'draft',
        enrolmentOpenAt: new Date('2026-01-15T00:00:00Z'),
        enrolmentCloseAt: new Date('2026-03-13T23:59:59Z'),
      },
    })
    trackDoc('semesters', id)

    const snap = await adminDb.collection('semesters').doc(id).get()
    expect(snap.exists).toBe(true)
    const data = snap.data()!
    expect(data['semesterCode']).toBe(code)
    expect(data['courseCode']).toBe('INTE2710')
    expect(data['status']).toBe('draft')

    // Natural-key guard doc must be written atomically alongside the
    // semester doc — concurrent creators of the same key collide on it.
    const guardSnap = await adminDb.collection('semesterNaturalKeys').doc(`INTE2710__${code}`).get()
    expect(guardSnap.exists).toBe(true)
    expect(guardSnap.data()?.['semesterId']).toBe(id)
  })

  it('rejects student with role_restricted_action', async () => {
    const handler = new CreateSemesterCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService,
      firestoreIdGenerator
    )
    await expect(
      handler.handle({
        actor: actorFor('student'),
        payload: {
          semesterCode: uniqueSemesterCode(),
          courseCode: 'INTE2710',
          displayName: 'X',
          status: 'draft',
          enrolmentOpenAt: undefined,
          enrolmentCloseAt: undefined,
        },
      })
    ).rejects.toMatchObject({ name: 'ForbiddenError', reason: 'role_restricted_action' })
  })

  it('duplicate (semesterCode, courseCode) returns ConflictError natural_key_exists', async () => {
    const handler = new CreateSemesterCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService,
      firestoreIdGenerator
    )
    const code = uniqueSemesterCode()
    const payload = {
      semesterCode: code,
      courseCode: 'INTE2710',
      displayName: 'Dup test',
      status: 'draft' as const,
      enrolmentOpenAt: undefined,
      enrolmentCloseAt: undefined,
    }
    const { id } = await handler.handle({ actor: actorFor('coordinator'), payload })
    trackDoc('semesters', id)

    await expect(handler.handle({ actor: actorFor('coordinator'), payload })).rejects.toMatchObject(
      { name: 'ConflictError', reason: 'natural_key_exists' }
    )
  })

  it('concurrent creates with the same natural key produce exactly one document', async () => {
    const handler = new CreateSemesterCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService,
      firestoreIdGenerator
    )
    const code = uniqueSemesterCode()
    const payload = {
      semesterCode: code,
      courseCode: 'INTE2711',
      displayName: 'Race',
      status: 'draft' as const,
      enrolmentOpenAt: undefined,
      enrolmentCloseAt: undefined,
    }

    const settled = await Promise.allSettled([
      handler.handle({ actor: actorFor('coordinator'), payload }),
      handler.handle({ actor: actorFor('coordinator'), payload }),
    ])
    const winners = settled.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<{
      id: string
    }>[]
    const losers = settled.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
    expect(winners.length).toBe(1)
    expect(losers.length).toBe(1)
    expect((losers[0]!.reason as { reason?: string }).reason).toBe('natural_key_exists')
    trackDoc('semesters', winners[0]!.value.id)

    const dupQuery = await adminDb
      .collection('semesters')
      .where('semesterCode', '==', code)
      .where('courseCode', '==', 'INTE2711')
      .get()
    expect(dupQuery.size).toBe(1)
  })
})
