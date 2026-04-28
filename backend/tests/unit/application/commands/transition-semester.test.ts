import { describe, it, expect } from 'vitest'
import { TransitionSemesterCommandHandler } from '../../../../src/application/commands/transition-semester'
import { Semester } from '../../../../src/domain/entities/semester'
import { buildMockUow, buildRequestActor, buildPlatformUser } from '../../../setup.unit'

function buildSemester(status: 'draft' | 'active' | 'archived' = 'draft', version = 1) {
  const now = new Date('2026-01-15T00:00:00Z')
  return Semester.rehydrate({
    id: 'sem_test',
    version,
    semesterCode: '2026-S1',
    courseCode: 'INTE2710',
    displayName: 'Sem 1',
    status,
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

describe('TransitionSemesterCommandHandler', () => {
  it('rejects student with role_restricted_action', async () => {
    const { uow } = buildMockUow()
    const handler = new TransitionSemesterCommandHandler(uow)
    await expect(
      handler.handle({ actor: student, semesterId: 'sem_test', to: 'active', comment: undefined })
    ).rejects.toMatchObject({ reason: 'role_restricted_action' })
  })

  it('throws NotFoundError when semester does not exist', async () => {
    const { uow, semesters } = buildMockUow()
    semesters.findById.mockResolvedValueOnce(null)
    const handler = new TransitionSemesterCommandHandler(uow)
    await expect(
      handler.handle({ actor: coord, semesterId: 'sem_test', to: 'active', comment: undefined })
    ).rejects.toMatchObject({ name: 'NotFoundError' })
  })

  it('draft → active mutates status, stages pendingTransition, and calls save', async () => {
    const { uow, semesters } = buildMockUow()
    const sem = buildSemester('draft', 7)
    semesters.findById.mockResolvedValueOnce(sem)
    const handler = new TransitionSemesterCommandHandler(uow)

    const result = await handler.handle({
      actor: coord,
      semesterId: 'sem_test',
      to: 'active',
      comment: 'going live',
    })

    expect(result.id).toBe('sem_test')
    expect(sem.status).toBe('active')
    // Aggregate carries the audit intent; repo drains it inside `save`.
    expect(semesters.save).toHaveBeenCalledOnce()
    const [savedSem] = semesters.save.mock.calls[0]!
    expect(savedSem).toBe(sem)
    const transition = sem.pendingTransition
    expect(transition?.from).toBe('draft')
    expect(transition?.to).toBe('active')
    expect(transition?.actorUserId).toBe('usr_coord')
    expect(transition?.comment).toBe('going live')
  })

  it('archived → active surfaces the aggregate ConflictError', async () => {
    const { uow, semesters } = buildMockUow()
    semesters.findById.mockResolvedValueOnce(buildSemester('archived'))
    const handler = new TransitionSemesterCommandHandler(uow)
    await expect(
      handler.handle({ actor: coord, semesterId: 'sem_test', to: 'active', comment: undefined })
    ).rejects.toMatchObject({ name: 'ConflictError', reason: 'invalid_state_transition' })
  })

  it('throws PreconditionFailedError on stale expectedVersion', async () => {
    const { uow, semesters } = buildMockUow()
    semesters.findById.mockResolvedValueOnce(buildSemester('draft', 7))
    const handler = new TransitionSemesterCommandHandler(uow)
    await expect(
      handler.handle({
        actor: coord,
        semesterId: 'sem_test',
        to: 'active',
        comment: undefined,
        metadata: { expectedVersion: 3 },
      })
    ).rejects.toMatchObject({ name: 'PreconditionFailedError', reason: 'etag_mismatch' })
  })
})
