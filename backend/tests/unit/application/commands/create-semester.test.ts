import { describe, it, expect } from 'vitest'
import { CreateSemesterCommandHandler } from '../../../../src/application/commands/create-semester'
import {
  buildMockUow,
  buildRequestActor,
  buildPlatformUser,
  buildMockIdGenerator,
} from '../../../setup.unit'

const validPayload = {
  semesterCode: '2026-S1',
  courseCode: 'INTE2710',
  displayName: 'Semester 1 2026',
  status: 'draft' as const,
  enrolmentOpenAt: undefined,
  enrolmentCloseAt: undefined,
}

describe('CreateSemesterCommandHandler', () => {
  it('rejects pre-sync caller with no_platform_user', async () => {
    const { uow } = buildMockUow()
    const handler = new CreateSemesterCommandHandler(uow, buildMockIdGenerator())

    await expect(
      handler.handle({ actor: buildRequestActor({ platformUser: null }), payload: validPayload })
    ).rejects.toMatchObject({ name: 'ForbiddenError', reason: 'no_platform_user' })
  })

  it('rejects student with role_restricted_action', async () => {
    const { uow } = buildMockUow()
    const handler = new CreateSemesterCommandHandler(uow, buildMockIdGenerator())

    await expect(
      handler.handle({
        actor: buildRequestActor({
          platformUser: buildPlatformUser({ id: 'usr_student', role: 'student' }),
        }),
        payload: validPayload,
      })
    ).rejects.toMatchObject({ name: 'ForbiddenError', reason: 'role_restricted_action' })
  })

  it('coordinator → handler returns the application-minted id', async () => {
    const { uow, semesters } = buildMockUow()
    semesters.create.mockResolvedValueOnce(undefined)
    // Application layer mints the id up-front; the repo writes the
    // aggregate under that id and returns void. The handler's result
    // surfaces the id it minted, NOT a value pulled from persistence.
    const handler = new CreateSemesterCommandHandler(uow, buildMockIdGenerator('sem_test'))

    const result = await handler.handle({
      actor: buildRequestActor({
        platformUser: buildPlatformUser({ id: 'usr_coord', role: 'coordinator' }),
      }),
      payload: validPayload,
    })

    expect(result.id).toBe('sem_test_001')
    expect(semesters.create).toHaveBeenCalledOnce()
    const [aggregate] = semesters.create.mock.calls[0]!
    expect(aggregate.id).toBe('sem_test_001')
  })

  it('propagates ConflictError(natural_key_exists) from the repo', async () => {
    const { uow, semesters } = buildMockUow()
    const conflict = Object.assign(new Error('dup'), {
      name: 'ConflictError',
      code: 'CONFLICT',
      reason: 'natural_key_exists',
    })
    semesters.create.mockRejectedValueOnce(conflict)
    const handler = new CreateSemesterCommandHandler(uow, buildMockIdGenerator())

    await expect(
      handler.handle({
        actor: buildRequestActor({
          platformUser: buildPlatformUser({ role: 'coordinator' }),
        }),
        payload: validPayload,
      })
    ).rejects.toMatchObject({ reason: 'natural_key_exists' })
  })
})
