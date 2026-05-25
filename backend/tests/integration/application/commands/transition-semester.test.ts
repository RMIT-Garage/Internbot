import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { CreateSemesterCommandHandler } from '../../../../src/application/commands/create-semester'
import { TransitionSemesterCommandHandler } from '../../../../src/application/commands/transition-semester'
import { GetSemesterQueryHandler } from '../../../../src/application/queries/get-semester'
import { FirestoreUnitOfWork } from '../../../../src/infrastructure/firestore/firestore-unit-of-work'
import { firestoreIdGenerator } from '../../../../src/infrastructure/firestore/firestore-id-generator'
import { firestoreSemesterQueryService } from '../../../../src/infrastructure/firestore/firestore-semester-query-service'
import { defaultAuthorizationService } from '../../../../src/infrastructure/authorization/default-authorization-service'
import { initEmulator, clearDocs, trackDoc } from '../../../setup.emulator'
import { adminDb } from '../../../../src/infrastructure/config/firebase-admin'
import type { RequestActor } from '../../../../src/application/actor'
import type { SemesterStatus } from '../../../../src/domain/value-objects/semester-enums'

function actorFor(role: 'student' | 'coordinator', id = `usr_${randomUUID()}`): RequestActor {
  return {
    firebaseUid: `fb_${randomUUID()}`,
    email: `${randomUUID().slice(0, 6)}@rmit.edu.au`,
    platformUser: { id, role },
  }
}

async function seedSemester(status: SemesterStatus = 'draft'): Promise<{ id: string }> {
  const create = new CreateSemesterCommandHandler(
    new FirestoreUnitOfWork(),
    defaultAuthorizationService,
    firestoreIdGenerator
  )
  const code = `2026-S${randomUUID()
    .slice(0, 6)
    .replace(/[^A-Za-z0-9]/g, 'a')}`
  const { id } = await create.handle({
    actor: actorFor('coordinator'),
    payload: {
      semesterCode: code,
      courseCode: 'INTE2710',
      displayName: 'Seed',
      status: 'draft',
      enrolmentOpenAt: undefined,
      enrolmentCloseAt: undefined,
    },
  })
  trackDoc('semesters', id)

  if (status !== 'draft') {
    const transition = new TransitionSemesterCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService
    )
    await transition.handle({
      actor: actorFor('coordinator'),
      semesterId: id,
      to: status === 'archived' ? 'archived' : 'enrollment_open',
      comment: undefined,
    })
    if (status === 'archived') {
      // draft → archived in one shot to avoid the disallowed active → archived
      // detour for tests that need archived state. This branch never runs
      // because the second arg is fixed above; left as a note.
    }
  }

  return { id }
}

describe('TransitionSemesterCommandHandler — integration', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
  })

  it('draft → enrollment_open updates parent status and writes an activity record', async () => {
    const { id } = await seedSemester('draft')
    const handler = new TransitionSemesterCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService
    )
    const get = new GetSemesterQueryHandler(
      firestoreSemesterQueryService,
      defaultAuthorizationService
    )

    const coord = actorFor('coordinator', `usr_${randomUUID()}`)
    await handler.handle({
      actor: coord,
      semesterId: id,
      to: 'enrollment_open',
      comment: 'kickoff',
    })

    const result = await get.handle({ actor: coord, semesterId: id })
    expect(result.semester.status).toBe('enrollment_open')

    const activity = await adminDb.collection('semesters').doc(id).collection('activity').get()
    expect(activity.size).toBe(1)
    const record = activity.docs[0]!.data()
    expect(record['from']).toBe('draft')
    expect(record['to']).toBe('enrollment_open')
    expect(record['actorUserId']).toBe(coord.platformUser!.id)
    expect(record['comment']).toBe('kickoff')
  })

  it('archived → enrollment_open succeeds (free-form transitions)', async () => {
    const create = new CreateSemesterCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService,
      firestoreIdGenerator
    )
    const code = `2026-S${randomUUID()
      .slice(0, 6)
      .replace(/[^A-Za-z0-9]/g, 'a')}`
    const { id } = await create.handle({
      actor: actorFor('coordinator'),
      payload: {
        semesterCode: code,
        courseCode: 'INTE2710',
        displayName: 'Already archived',
        status: 'draft',
        enrolmentOpenAt: undefined,
        enrolmentCloseAt: undefined,
      },
    })
    trackDoc('semesters', id)

    const handler = new TransitionSemesterCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService
    )
    await handler.handle({
      actor: actorFor('coordinator'),
      semesterId: id,
      to: 'archived',
      comment: undefined,
    })

    await expect(
      handler.handle({
        actor: actorFor('coordinator'),
        semesterId: id,
        to: 'enrollment_open',
        comment: undefined,
      })
    ).resolves.toMatchObject({ id })
  })

  it('stale expectedVersion throws PreconditionFailedError', async () => {
    const { id } = await seedSemester('draft')
    const handler = new TransitionSemesterCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService
    )
    await expect(
      handler.handle({
        actor: actorFor('coordinator'),
        semesterId: id,
        to: 'enrollment_open',
        comment: undefined,
        metadata: { expectedVersion: 0 },
      })
    ).rejects.toMatchObject({ name: 'PreconditionFailedError', reason: 'etag_mismatch' })
  })
})
