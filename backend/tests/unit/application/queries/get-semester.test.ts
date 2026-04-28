import { describe, it, expect } from 'vitest'
import { GetSemesterQueryHandler } from '../../../../src/application/queries/get-semester'
import { Semester } from '../../../../src/domain/entities/semester'
import { buildMockUow, buildRequestActor, buildPlatformUser } from '../../../setup.unit'

function buildSemester() {
  const now = new Date('2026-01-15T00:00:00Z')
  return Semester.rehydrate({
    id: 'sem_test',
    version: 1,
    semesterCode: '2026-S1',
    courseCode: 'INTE2710',
    displayName: 'Sem 1',
    status: 'draft',
    enrolmentOpenAt: undefined,
    enrolmentCloseAt: undefined,
    createdAt: now,
    updatedAt: now,
  })
}

describe('GetSemesterQueryHandler', () => {
  it('rejects pre-sync caller with no_platform_user', async () => {
    const { uow } = buildMockUow()
    const handler = new GetSemesterQueryHandler(uow)
    await expect(
      handler.handle({ actor: buildRequestActor({ platformUser: null }), semesterId: 'sem_test' })
    ).rejects.toMatchObject({ reason: 'no_platform_user' })
  })

  it('student can read any semester', async () => {
    const { uow, semesters } = buildMockUow()
    semesters.findById.mockResolvedValueOnce(buildSemester())
    const handler = new GetSemesterQueryHandler(uow)
    const result = await handler.handle({
      actor: buildRequestActor({ platformUser: buildPlatformUser({ role: 'student' }) }),
      semesterId: 'sem_test',
    })
    expect(result.semester.id).toBe('sem_test')
  })

  it('coordinator can read any semester', async () => {
    const { uow, semesters } = buildMockUow()
    semesters.findById.mockResolvedValueOnce(buildSemester())
    const handler = new GetSemesterQueryHandler(uow)
    const result = await handler.handle({
      actor: buildRequestActor({ platformUser: buildPlatformUser({ role: 'coordinator' }) }),
      semesterId: 'sem_test',
    })
    expect(result.semester.id).toBe('sem_test')
  })

  it('returns NotFoundError when missing', async () => {
    const { uow, semesters } = buildMockUow()
    semesters.findById.mockResolvedValueOnce(null)
    const handler = new GetSemesterQueryHandler(uow)
    await expect(
      handler.handle({
        actor: buildRequestActor({ platformUser: buildPlatformUser() }),
        semesterId: 'sem_missing',
      })
    ).rejects.toMatchObject({ name: 'NotFoundError' })
  })
})
