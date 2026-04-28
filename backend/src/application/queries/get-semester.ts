import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { SemesterResult } from '../models/semester'
import { ForbiddenError, NotFoundError } from '../../domain/errors'

/**
 * GET /api/v1/semesters/:id query — returns one semester record.
 *
 * Authorization per WORKFLOW-API-SPEC.md §7.5: any authenticated platform
 * user (student or coordinator) may read. Pre-sync callers (`platformUser`
 * is null) are rejected with `no_platform_user`.
 */
export interface GetSemesterQuery {
  actor: RequestActor
  semesterId: string
}

export class GetSemesterQueryHandler {
  constructor(private readonly uow: UnitOfWork) {}

  async handle(q: GetSemesterQuery): Promise<SemesterResult> {
    if (!q.actor.platformUser) {
      throw new ForbiddenError(
        'Caller has no platform user record. Call POST /api/v1/auth/sync first.',
        'no_platform_user'
      )
    }

    return this.uow.execute(async (ctx) => {
      const semester = await ctx.semesters.findById(q.semesterId)
      if (!semester) throw new NotFoundError('Semester', q.semesterId)
      return { semester }
    })
  }
}
