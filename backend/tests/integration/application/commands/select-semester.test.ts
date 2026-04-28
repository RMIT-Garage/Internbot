import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { SelectSemesterCommandHandler } from '../../../../src/application/commands/select-semester'
import { UpdateUserProfileCommandHandler } from '../../../../src/application/commands/update-user-profile'
import { CreateSemesterCommandHandler } from '../../../../src/application/commands/create-semester'
import { TransitionSemesterCommandHandler } from '../../../../src/application/commands/transition-semester'
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

function actorFor(id: string, role: 'student' | 'coordinator'): RequestActor {
  return { firebaseUid: `fb_${randomUUID()}`, email: 'a@b.com', platformUser: { id, role } }
}

function uniqueSemesterCode(): string {
  return `2026-S${randomUUID()
    .slice(0, 4)
    .replace(/[^A-Za-z0-9]/g, 'a')}`
}

async function seedStudent(opts: { complete: boolean }): Promise<{ id: string }> {
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
  if (opts.complete) {
    const update = new UpdateUserProfileCommandHandler(new FirestoreUnitOfWork())
    await update.handle({
      actor: actorFor(id, 'student'),
      userId: id,
      patch: { programCode: 'BP096', academicInfo: completeAcademicInfo },
    })
  }
  return { id }
}

async function seedActiveSemester(
  opts: { open?: Date; close?: Date } = {}
): Promise<{ id: string }> {
  const create = new CreateSemesterCommandHandler(new FirestoreUnitOfWork(), firestoreIdGenerator)
  const transition = new TransitionSemesterCommandHandler(new FirestoreUnitOfWork())
  const coord = actorFor(`usr_coord_${randomUUID()}`, 'coordinator')
  const { id } = await create.handle({
    actor: coord,
    payload: {
      semesterCode: uniqueSemesterCode(),
      courseCode: 'INTE2710',
      displayName: 'Test Semester',
      status: 'draft',
      enrolmentOpenAt: opts.open,
      enrolmentCloseAt: opts.close,
    },
  })
  trackDoc('semesters', id)
  await transition.handle({
    actor: coord,
    semesterId: id,
    to: 'active',
    comment: undefined,
  })
  return { id }
}

async function seedDraftSemester(): Promise<{ id: string }> {
  const create = new CreateSemesterCommandHandler(new FirestoreUnitOfWork(), firestoreIdGenerator)
  const { id } = await create.handle({
    actor: actorFor(`usr_coord_${randomUUID()}`, 'coordinator'),
    payload: {
      semesterCode: uniqueSemesterCode(),
      courseCode: 'INTE2711',
      displayName: 'Draft Semester',
      status: 'draft',
      enrolmentOpenAt: undefined,
      enrolmentCloseAt: undefined,
    },
  })
  trackDoc('semesters', id)
  return { id }
}

describe('SelectSemesterCommandHandler — integration', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
    await clearAuthUsers()
  })

  it('happy path: writes semesterId + semesterSelectedAt on the student profile', async () => {
    const student = await seedStudent({ complete: true })
    const semester = await seedActiveSemester()
    const select = new SelectSemesterCommandHandler(new FirestoreUnitOfWork())
    const read = new GetUserQueryHandler(new FirestoreUnitOfWork())

    await select.handle({
      actor: actorFor(student.id, 'student'),
      userId: student.id,
      payload: { semesterId: semester.id },
    })

    const { user } = await read.handle({
      actor: actorFor(student.id, 'student'),
      userId: student.id,
    })
    expect(user.studentProfile?.semesterId).toBe(semester.id)
    expect(user.studentProfile?.semesterSelectedAt).toBeInstanceOf(Date)
  })

  it('preserves semesterSelectedAt across re-selection', async () => {
    const student = await seedStudent({ complete: true })
    const a = await seedActiveSemester()
    const b = await seedActiveSemester()
    const select = new SelectSemesterCommandHandler(new FirestoreUnitOfWork())
    const read = new GetUserQueryHandler(new FirestoreUnitOfWork())

    await select.handle({
      actor: actorFor(student.id, 'student'),
      userId: student.id,
      payload: { semesterId: a.id },
    })
    const first = await read.handle({
      actor: actorFor(student.id, 'student'),
      userId: student.id,
    })
    const firstSelectedAt = first.user.studentProfile?.semesterSelectedAt

    // Tiny gap so the wall-clock timestamps differ — guards against the
    // bug where a re-selection rewrites the original `selectedAt`.
    await new Promise((r) => setTimeout(r, 10))

    await select.handle({
      actor: actorFor(student.id, 'student'),
      userId: student.id,
      payload: { semesterId: b.id },
    })
    const second = await read.handle({
      actor: actorFor(student.id, 'student'),
      userId: student.id,
    })
    expect(second.user.studentProfile?.semesterId).toBe(b.id)
    expect(second.user.studentProfile?.semesterSelectedAt?.getTime()).toBe(
      firstSelectedAt?.getTime()
    )
  })

  it('incomplete profile → ConflictError(profile_incomplete)', async () => {
    const student = await seedStudent({ complete: false })
    const semester = await seedActiveSemester()
    const select = new SelectSemesterCommandHandler(new FirestoreUnitOfWork())

    await expect(
      select.handle({
        actor: actorFor(student.id, 'student'),
        userId: student.id,
        payload: { semesterId: semester.id },
      })
    ).rejects.toMatchObject({ name: 'ConflictError', reason: 'profile_incomplete' })
  })

  it('non-active semester → ConflictError(semester_not_active)', async () => {
    const student = await seedStudent({ complete: true })
    const draft = await seedDraftSemester()
    const select = new SelectSemesterCommandHandler(new FirestoreUnitOfWork())

    await expect(
      select.handle({
        actor: actorFor(student.id, 'student'),
        userId: student.id,
        payload: { semesterId: draft.id },
      })
    ).rejects.toMatchObject({ name: 'ConflictError', reason: 'semester_not_active' })
  })

  it('outside the enrolment window → ConflictError(enrolment_window_closed)', async () => {
    const student = await seedStudent({ complete: true })
    const semester = await seedActiveSemester({
      open: new Date('2024-01-01T00:00:00Z'),
      close: new Date('2024-02-01T00:00:00Z'),
    })
    const select = new SelectSemesterCommandHandler(new FirestoreUnitOfWork())

    await expect(
      select.handle({
        actor: actorFor(student.id, 'student'),
        userId: student.id,
        payload: { semesterId: semester.id },
      })
    ).rejects.toMatchObject({ name: 'ConflictError', reason: 'enrolment_window_closed' })
  })

  it('missing semester id → NotFoundError', async () => {
    const student = await seedStudent({ complete: true })
    const select = new SelectSemesterCommandHandler(new FirestoreUnitOfWork())

    await expect(
      select.handle({
        actor: actorFor(student.id, 'student'),
        userId: student.id,
        payload: { semesterId: 'sem_does_not_exist' },
      })
    ).rejects.toMatchObject({ name: 'NotFoundError' })
  })

  it('non-owner student is rejected with student_not_owner', async () => {
    const owner = await seedStudent({ complete: true })
    const other = await seedStudent({ complete: true })
    const semester = await seedActiveSemester()
    const select = new SelectSemesterCommandHandler(new FirestoreUnitOfWork())

    await expect(
      select.handle({
        actor: actorFor(other.id, 'student'),
        userId: owner.id,
        payload: { semesterId: semester.id },
      })
    ).rejects.toMatchObject({ name: 'ForbiddenError', reason: 'student_not_owner' })
  })

  it('coordinator caller is rejected with role_restricted_action', async () => {
    const student = await seedStudent({ complete: true })
    const semester = await seedActiveSemester()
    const select = new SelectSemesterCommandHandler(new FirestoreUnitOfWork())

    await expect(
      select.handle({
        actor: actorFor(`usr_coord_${randomUUID()}`, 'coordinator'),
        userId: student.id,
        payload: { semesterId: semester.id },
      })
    ).rejects.toMatchObject({ name: 'ForbiddenError', reason: 'role_restricted_action' })
  })
})
