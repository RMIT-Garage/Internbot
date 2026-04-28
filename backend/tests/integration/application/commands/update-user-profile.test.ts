import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { UpdateUserProfileCommandHandler } from '../../../../src/application/commands/update-user-profile'
import { GetUserQueryHandler } from '../../../../src/application/queries/get-user'
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
import type { RequestActor } from '../../../../src/application/actor'

const completeAcademicInfo = {
  programName: 'Bachelor of Software Engineering',
  programLevel: 'undergraduate' as const,
  unitsAttempted: 192,
  creditUnitsEarned: 168,
  gpa: 3.2,
  currentStudyLoad: 'full_time' as const,
}

async function seedStudent(): Promise<{ id: string; firebaseUid: string; studentNumber: string }> {
  const firebaseUid = `fb_${randomUUID()}`
  const email = `${randomUUID().slice(0, 8)}@student.rmit.edu.au`
  await ensureFirebaseUser(firebaseUid, email)
  const studentNumber = `s${Math.floor(Math.random() * 1e9)}`
  const sync = new SyncUserCommandHandler(
    new FirestoreUnitOfWork(),
    new FirebasePlatformClaimsService(),
    firestoreIdGenerator
  )
  const { id } = await sync.handle({
    actor: { firebaseUid, email, platformUser: null },
    studentNumber,
    displayName: undefined,
  })
  trackDoc('users', id)
  return { id, firebaseUid, studentNumber }
}

function actorFor(id: string, role: 'student' | 'coordinator'): RequestActor {
  return { firebaseUid: `fb_${randomUUID()}`, email: 'a@b.com', platformUser: { id, role } }
}

describe('UpdateUserProfileCommandHandler — integration', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
    await clearAuthUsers()
  })

  it('owner with all required academic fields transitions profileStatus to complete and sets confirmedAt', async () => {
    const student = await seedStudent()
    const update = new UpdateUserProfileCommandHandler(new FirestoreUnitOfWork())
    const read = new GetUserQueryHandler(new FirestoreUnitOfWork())

    await update.handle({
      actor: actorFor(student.id, 'student'),
      userId: student.id,
      patch: { programCode: 'BP096', academicInfo: completeAcademicInfo },
    })

    const { user } = await read.handle({
      actor: actorFor(student.id, 'coordinator'),
      userId: student.id,
    })
    expect(user.studentProfile?.profileStatus).toBe('complete')
    expect(user.studentProfile?.academicInfo?.confirmedAt).toBeInstanceOf(Date)
    expect(user.onboardingStage).toBe('profile_complete')
  })

  it('attempting to change studentNumber to a different value throws ValidationError with immutable_field', async () => {
    const student = await seedStudent()
    const update = new UpdateUserProfileCommandHandler(new FirestoreUnitOfWork())

    await expect(
      update.handle({
        actor: actorFor(student.id, 'student'),
        userId: student.id,
        patch: { studentNumber: `s${Math.floor(Math.random() * 1e9)}` },
      })
    ).rejects.toMatchObject({ name: 'ValidationError', reason: 'immutable_field' })
  })

  it('same studentNumber is a no-op (accepted)', async () => {
    const student = await seedStudent()
    const update = new UpdateUserProfileCommandHandler(new FirestoreUnitOfWork())

    await update.handle({
      actor: actorFor(student.id, 'student'),
      userId: student.id,
      patch: { studentNumber: student.studentNumber, programCode: 'BP096' },
    })
  })

  it('coordinator caller is rejected with MethodNotAllowedError (role_restricted_action, allow=GET)', async () => {
    const student = await seedStudent()
    const update = new UpdateUserProfileCommandHandler(new FirestoreUnitOfWork())

    await expect(
      update.handle({
        actor: actorFor(`usr_${randomUUID()}`, 'coordinator'),
        userId: student.id,
        patch: { programCode: 'BP096' },
      })
    ).rejects.toMatchObject({
      name: 'MethodNotAllowedError',
      reason: 'role_restricted_action',
      allow: 'GET',
    })
  })

  it('student updating another student is rejected with ForbiddenError (student_not_owner)', async () => {
    const owner = await seedStudent()
    const other = await seedStudent()
    const update = new UpdateUserProfileCommandHandler(new FirestoreUnitOfWork())

    await expect(
      update.handle({
        actor: actorFor(other.id, 'student'),
        userId: owner.id,
        patch: { programCode: 'BP096' },
      })
    ).rejects.toMatchObject({ name: 'ForbiddenError', reason: 'student_not_owner' })
  })

  it('stale If-Match throws PreconditionFailedError with etag_mismatch', async () => {
    const student = await seedStudent()
    const update = new UpdateUserProfileCommandHandler(new FirestoreUnitOfWork())

    await expect(
      update.handle({
        actor: actorFor(student.id, 'student'),
        userId: student.id,
        metadata: { expectedVersion: 0 },
        patch: { programCode: 'BP096' },
      })
    ).rejects.toMatchObject({ name: 'PreconditionFailedError', reason: 'etag_mismatch' })
  })

  it('partial patch that leaves academicInfo missing keeps profileStatus=incomplete', async () => {
    const student = await seedStudent()
    const update = new UpdateUserProfileCommandHandler(new FirestoreUnitOfWork())
    const read = new GetUserQueryHandler(new FirestoreUnitOfWork())

    await update.handle({
      actor: actorFor(student.id, 'student'),
      userId: student.id,
      patch: { programCode: 'BP096' },
    })

    const { user } = await read.handle({
      actor: actorFor(student.id, 'coordinator'),
      userId: student.id,
    })
    expect(user.studentProfile?.profileStatus).toBe('incomplete')
    expect(user.studentProfile?.academicInfo?.confirmedAt).toBeUndefined()
  })

  it('confirmedAt is NOT rewritten on subsequent complete-to-complete patches', async () => {
    const student = await seedStudent()
    const update = new UpdateUserProfileCommandHandler(new FirestoreUnitOfWork())
    const read = new GetUserQueryHandler(new FirestoreUnitOfWork())

    await update.handle({
      actor: actorFor(student.id, 'student'),
      userId: student.id,
      patch: { programCode: 'BP096', academicInfo: completeAcademicInfo },
    })
    const first = await read.handle({
      actor: actorFor(student.id, 'coordinator'),
      userId: student.id,
    })
    const firstConfirmedAt = first.user.studentProfile?.academicInfo?.confirmedAt
    expect(firstConfirmedAt).toBeInstanceOf(Date)

    await update.handle({
      actor: actorFor(student.id, 'student'),
      userId: student.id,
      patch: { academicInfo: { ...completeAcademicInfo, gpa: 3.4 } },
    })
    const second = await read.handle({
      actor: actorFor(student.id, 'coordinator'),
      userId: student.id,
    })
    const secondConfirmedAt = second.user.studentProfile?.academicInfo?.confirmedAt
    expect(secondConfirmedAt?.getTime()).toBe(firstConfirmedAt?.getTime())
  })
})
