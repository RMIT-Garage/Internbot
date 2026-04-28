import { describe, it, expect } from 'vitest'
import { ListSemestersQueryHandler } from '../../../../src/application/queries/list-semesters'
import { Semester } from '../../../../src/domain/entities/semester'
import { buildMockUow, buildRequestActor, buildPlatformUser } from '../../../setup.unit'

function buildSemester(id: string) {
  const now = new Date('2026-01-15T00:00:00Z')
  return Semester.rehydrate({
    id,
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

const baseFilter = {
  status: undefined,
  semesterCode: undefined,
  courseCode: undefined,
  limit: 50,
  sortField: 'createdAt' as const,
  sortDirection: 'desc' as const,
  cursor: undefined,
}

describe('ListSemestersQueryHandler', () => {
  it('rejects pre-sync caller', async () => {
    const { uow } = buildMockUow()
    const handler = new ListSemestersQueryHandler(uow)
    await expect(
      handler.handle({ actor: buildRequestActor({ platformUser: null }), filter: baseFilter })
    ).rejects.toMatchObject({ reason: 'no_platform_user' })
  })

  it('returns items + nextCursor from the repo page', async () => {
    const { uow, semesters } = buildMockUow()
    semesters.list.mockResolvedValueOnce({
      items: [buildSemester('sem_a'), buildSemester('sem_b')],
      nextCursor: {
        sortField: 'createdAt',
        sortDirection: 'desc',
        lastValue: null,
        lastDocId: 'sem_b',
      },
    })
    const handler = new ListSemestersQueryHandler(uow)
    const result = await handler.handle({
      actor: buildRequestActor({ platformUser: buildPlatformUser({ role: 'student' }) }),
      filter: baseFilter,
    })
    expect(result.items.map((s) => s.id)).toEqual(['sem_a', 'sem_b'])
    expect(result.cursor?.lastDocId).toBe('sem_b')
  })

  it('null cursor when there is no next page', async () => {
    const { uow, semesters } = buildMockUow()
    semesters.list.mockResolvedValueOnce({ items: [], nextCursor: null })
    const handler = new ListSemestersQueryHandler(uow)
    const result = await handler.handle({
      actor: buildRequestActor({ platformUser: buildPlatformUser() }),
      filter: baseFilter,
    })
    expect(result.cursor).toBeNull()
  })
})
