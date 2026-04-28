import { describe, it, expect } from 'vitest'
import { SelectSemesterCommandHandler } from '../../../../src/application/commands/select-semester'
import { User } from '../../../../src/domain/entities/user'
import { Semester } from '../../../../src/domain/entities/semester'
import { StudentProfile } from '../../../../src/domain/value-objects/student-profile'
import { AcademicInfo } from '../../../../src/domain/value-objects/academic-info'
import { UserIdentity } from '../../../../src/domain/value-objects/user-identity'

function identityFor(uid: string): UserIdentity {
  return UserIdentity.rehydrate({
    provider: 'firebase',
    providerUserId: uid,
    emailSnapshot: undefined,
  })
}
import { buildMockUow, buildRequestActor, buildPlatformUser } from '../../../setup.unit'

const NOW = new Date('2026-04-01T00:00:00Z')

function completeProfile(): StudentProfile {
  return StudentProfile.rehydrate({
    studentNumber: 's1234567',
    profileStatus: 'complete',
    programCode: 'BP096',
    phone: undefined,
    academicInfo: AcademicInfo.rehydrate({
      programName: 'Bachelor of SE',
      programLevel: 'undergraduate',
      unitsAttempted: 192,
      creditUnitsEarned: 168,
      gpa: 3.2,
      currentStudyLoad: 'full_time',
      programStatus: undefined,
      majors: undefined,
      minors: undefined,
      notes: undefined,
      confirmedAt: NOW,
    }),
    semesterId: undefined,
    semesterSelectedAt: undefined,
  })
}

function incompleteProfile(): StudentProfile {
  return StudentProfile.rehydrate({
    studentNumber: 's1234567',
    profileStatus: 'incomplete',
    programCode: undefined,
    phone: undefined,
    academicInfo: undefined,
    semesterId: undefined,
    semesterSelectedAt: undefined,
  })
}

function buildStudent(id = 'usr_student', profile?: StudentProfile): User {
  return User.rehydrate({
    id,
    version: 1,
    email: 's@example.com',
    role: 'student',
    status: 'active',
    onboardingStage: 'profile_complete',
    identity: identityFor(`fb_${id}`),
    createdAt: NOW,
    updatedAt: NOW,
    displayName: undefined,
    studentProfile: profile ?? completeProfile(),
  })
}

function buildSemester(
  opts: {
    status?: 'draft' | 'active' | 'archived'
    open?: Date
    close?: Date
  } = {}
): Semester {
  return Semester.rehydrate({
    id: 'sem_001',
    version: 1,
    semesterCode: '2026-S1',
    courseCode: 'INTE2710',
    displayName: 'Sem 1 2026',
    status: opts.status ?? 'active',
    enrolmentOpenAt: opts.open,
    enrolmentCloseAt: opts.close,
    createdAt: NOW,
    updatedAt: NOW,
  })
}

describe('SelectSemesterCommandHandler', () => {
  it('rejects pre-sync caller with no_platform_user', async () => {
    const { uow } = buildMockUow()
    const handler = new SelectSemesterCommandHandler(uow)
    await expect(
      handler.handle({
        actor: buildRequestActor({ platformUser: null }),
        userId: 'usr_student',
        payload: { semesterId: 'sem_001' },
      })
    ).rejects.toMatchObject({ reason: 'no_platform_user' })
  })

  it('rejects coordinator with role_restricted_action', async () => {
    const { uow } = buildMockUow()
    const handler = new SelectSemesterCommandHandler(uow)
    await expect(
      handler.handle({
        actor: buildRequestActor({
          platformUser: buildPlatformUser({ id: 'usr_coord', role: 'coordinator' }),
        }),
        userId: 'usr_coord',
        payload: { semesterId: 'sem_001' },
      })
    ).rejects.toMatchObject({ reason: 'role_restricted_action' })
  })

  it('rejects student writing for a different user with student_not_owner', async () => {
    const { uow } = buildMockUow()
    const handler = new SelectSemesterCommandHandler(uow)
    await expect(
      handler.handle({
        actor: buildRequestActor({
          platformUser: buildPlatformUser({ id: 'usr_a', role: 'student' }),
        }),
        userId: 'usr_b',
        payload: { semesterId: 'sem_001' },
      })
    ).rejects.toMatchObject({ reason: 'student_not_owner' })
  })

  it('returns NotFoundError when target user is missing', async () => {
    const { uow, users } = buildMockUow()
    users.findById.mockResolvedValueOnce(null)
    const handler = new SelectSemesterCommandHandler(uow)
    await expect(
      handler.handle({
        actor: buildRequestActor({
          platformUser: buildPlatformUser({ id: 'usr_student', role: 'student' }),
        }),
        userId: 'usr_student',
        payload: { semesterId: 'sem_001' },
      })
    ).rejects.toMatchObject({ name: 'NotFoundError' })
  })

  it('returns NotFoundError when target user is a coordinator (sub-resource does not exist)', async () => {
    const { uow, users } = buildMockUow()
    const coord = User.rehydrate({
      id: 'usr_coord',
      version: 1,
      email: 'c@example.com',
      role: 'coordinator',
      status: 'active',
      onboardingStage: 'profile_complete',
      identity: identityFor('fb_coord'),
      createdAt: NOW,
      updatedAt: NOW,
      displayName: undefined,
      studentProfile: undefined,
    })
    users.findById.mockResolvedValueOnce(coord)
    const handler = new SelectSemesterCommandHandler(uow)
    // The student authz check would normally trip first when ids match —
    // simulate the spec scenario where the caller IS the target.
    await expect(
      handler.handle({
        actor: buildRequestActor({
          platformUser: buildPlatformUser({ id: 'usr_coord', role: 'student' }),
        }),
        userId: 'usr_coord',
        payload: { semesterId: 'sem_001' },
      })
    ).rejects.toMatchObject({ name: 'NotFoundError' })
  })

  it('throws PreconditionFailedError on stale If-Match', async () => {
    const { uow, users } = buildMockUow()
    users.findById.mockResolvedValueOnce(buildStudent())
    const handler = new SelectSemesterCommandHandler(uow)
    await expect(
      handler.handle({
        actor: buildRequestActor({
          platformUser: buildPlatformUser({ id: 'usr_student', role: 'student' }),
        }),
        userId: 'usr_student',
        payload: { semesterId: 'sem_001' },
        metadata: { expectedVersion: 99 },
      })
    ).rejects.toMatchObject({ name: 'PreconditionFailedError' })
  })

  it('returns NotFoundError when referenced semester does not exist', async () => {
    const { uow, users, semesters } = buildMockUow()
    users.findById.mockResolvedValueOnce(buildStudent())
    semesters.findById.mockResolvedValueOnce(null)
    const handler = new SelectSemesterCommandHandler(uow)
    await expect(
      handler.handle({
        actor: buildRequestActor({
          platformUser: buildPlatformUser({ id: 'usr_student', role: 'student' }),
        }),
        userId: 'usr_student',
        payload: { semesterId: 'sem_missing' },
      })
    ).rejects.toMatchObject({ name: 'NotFoundError' })
  })

  it('throws ConflictError(semester_not_active) when semester is draft', async () => {
    const { uow, users, semesters } = buildMockUow()
    users.findById.mockResolvedValueOnce(buildStudent())
    semesters.findById.mockResolvedValueOnce(buildSemester({ status: 'draft' }))
    const handler = new SelectSemesterCommandHandler(uow)
    await expect(
      handler.handle({
        actor: buildRequestActor({
          platformUser: buildPlatformUser({ id: 'usr_student', role: 'student' }),
        }),
        userId: 'usr_student',
        payload: { semesterId: 'sem_001' },
      })
    ).rejects.toMatchObject({ name: 'ConflictError', reason: 'semester_not_active' })
  })

  it('throws ConflictError(enrolment_window_closed) when window has closed', async () => {
    const { uow, users, semesters } = buildMockUow()
    users.findById.mockResolvedValueOnce(buildStudent())
    semesters.findById.mockResolvedValueOnce(
      buildSemester({
        status: 'active',
        open: new Date('2026-01-01T00:00:00Z'),
        close: new Date('2026-02-01T00:00:00Z'),
      })
    )
    const handler = new SelectSemesterCommandHandler(uow)
    await expect(
      handler.handle({
        actor: buildRequestActor({
          platformUser: buildPlatformUser({ id: 'usr_student', role: 'student' }),
        }),
        userId: 'usr_student',
        payload: { semesterId: 'sem_001' },
      })
    ).rejects.toMatchObject({ name: 'ConflictError', reason: 'enrolment_window_closed' })
  })

  it('throws ConflictError(profile_incomplete) when profile is not complete', async () => {
    const { uow, users, semesters } = buildMockUow()
    users.findById.mockResolvedValueOnce(buildStudent('usr_student', incompleteProfile()))
    semesters.findById.mockResolvedValueOnce(buildSemester({ status: 'active' }))
    const handler = new SelectSemesterCommandHandler(uow)
    await expect(
      handler.handle({
        actor: buildRequestActor({
          platformUser: buildPlatformUser({ id: 'usr_student', role: 'student' }),
        }),
        userId: 'usr_student',
        payload: { semesterId: 'sem_001' },
      })
    ).rejects.toMatchObject({ name: 'ConflictError', reason: 'profile_incomplete' })
  })

  it('happy path: mutates profile and saves user', async () => {
    const { uow, users, semesters } = buildMockUow()
    const student = buildStudent()
    users.findById.mockResolvedValueOnce(student)
    semesters.findById.mockResolvedValueOnce(buildSemester({ status: 'active' }))
    users.save.mockResolvedValueOnce(undefined)
    const handler = new SelectSemesterCommandHandler(uow)
    const result = await handler.handle({
      actor: buildRequestActor({
        platformUser: buildPlatformUser({ id: 'usr_student', role: 'student' }),
      }),
      userId: 'usr_student',
      payload: { semesterId: 'sem_001' },
    })
    expect(result.id).toBe('usr_student')
    expect(student.studentProfile?.semesterId).toBe('sem_001')
    expect(users.save).toHaveBeenCalledOnce()
  })
})
