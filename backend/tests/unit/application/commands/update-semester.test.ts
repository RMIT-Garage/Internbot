import { describe, it, expect } from 'vitest'
import { UpdateSemesterCommandHandler } from '../../../../src/application/commands/update-semester'
import { Semester } from '../../../../src/domain/entities/semester'
import { buildMockUow, buildRequestActor, buildPlatformUser } from '../../../setup.unit'

function buildSemester(version = 1) {
  const now = new Date('2026-01-15T00:00:00Z')
  return Semester.rehydrate({
    id: 'sem_test',
    version,
    semesterCode: '2026-S1',
    courseCode: 'INTE2710',
    displayName: 'Original',
    status: 'draft',
    enrolmentOpenAt: undefined,
    enrolmentCloseAt: undefined,
    createdAt: now,
    updatedAt: now,
  })
}

const coord = buildRequestActor({
  platformUser: buildPlatformUser({ id: 'usr_coord', role: 'coordinator' }),
})
const student = buildRequestActor({
  platformUser: buildPlatformUser({ id: 'usr_student', role: 'student' }),
})

describe('UpdateSemesterCommandHandler', () => {
  it('rejects pre-sync caller with no_platform_user', async () => {
    const { uow } = buildMockUow()
    const handler = new UpdateSemesterCommandHandler(uow)
    await expect(
      handler.handle({
        actor: buildRequestActor({ platformUser: null }),
        semesterId: 'sem_test',
        patch: { displayName: 'New' },
      })
    ).rejects.toMatchObject({ reason: 'no_platform_user' })
  })

  it('rejects student with role_restricted_action', async () => {
    const { uow } = buildMockUow()
    const handler = new UpdateSemesterCommandHandler(uow)
    await expect(
      handler.handle({ actor: student, semesterId: 'sem_test', patch: { displayName: 'New' } })
    ).rejects.toMatchObject({ reason: 'role_restricted_action' })
  })

  it('throws NotFoundError when semester does not exist', async () => {
    const { uow, semesters } = buildMockUow()
    semesters.findById.mockResolvedValueOnce(null)
    const handler = new UpdateSemesterCommandHandler(uow)
    await expect(
      handler.handle({ actor: coord, semesterId: 'sem_test', patch: { displayName: 'New' } })
    ).rejects.toMatchObject({ name: 'NotFoundError' })
  })

  it('throws PreconditionFailedError on stale expectedVersion', async () => {
    const { uow, semesters } = buildMockUow()
    semesters.findById.mockResolvedValueOnce(buildSemester(5))
    const handler = new UpdateSemesterCommandHandler(uow)
    await expect(
      handler.handle({
        actor: coord,
        semesterId: 'sem_test',
        patch: { displayName: 'New' },
        metadata: { expectedVersion: 3 },
      })
    ).rejects.toMatchObject({ name: 'PreconditionFailedError', reason: 'etag_mismatch' })
  })

  it('coordinator with valid patch → calls save with mutated aggregate', async () => {
    const { uow, semesters } = buildMockUow()
    const sem = buildSemester(7)
    semesters.findById.mockResolvedValueOnce(sem)
    const handler = new UpdateSemesterCommandHandler(uow)
    const result = await handler.handle({
      actor: coord,
      semesterId: 'sem_test',
      patch: { displayName: 'New', enrolmentOpenAt: new Date('2026-01-15T00:00:00Z') },
    })
    expect(result.id).toBe('sem_test')
    expect(sem.displayName).toBe('New')
    expect(sem.enrolmentOpenAt?.toISOString()).toBe('2026-01-15T00:00:00.000Z')
    expect(semesters.save).toHaveBeenCalledWith(sem)
  })

  it('null on enrolmentOpenAt clears the field', async () => {
    const { uow, semesters } = buildMockUow()
    const sem = buildSemester()
    sem.changeEnrolmentOpenAt(new Date('2026-01-15T00:00:00Z'))
    semesters.findById.mockResolvedValueOnce(sem)
    const handler = new UpdateSemesterCommandHandler(uow)
    await handler.handle({
      actor: coord,
      semesterId: 'sem_test',
      patch: { enrolmentOpenAt: null },
    })
    expect(sem.enrolmentOpenAt).toBeUndefined()
  })
})
