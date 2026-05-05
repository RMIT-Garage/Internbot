import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { InternshipResult } from '../models/internship'
import { ForbiddenError, NotFoundError } from '../../domain/errors'
import { buildInternshipReadModel } from './internship-read-model'

export interface GetInternshipQuery {
  actor: RequestActor
  internshipId: string
}

export class GetInternshipQueryHandler {
  constructor(private readonly uow: UnitOfWork) {}

  async handle(q: GetInternshipQuery): Promise<InternshipResult> {
    const platformUser = q.actor.platformUser
    if (!platformUser) {
      throw new ForbiddenError('Caller has no platform user record.', 'no_platform_user')
    }

    return this.uow.execute(async (ctx) => {
      const internship = await ctx.internships.findById(q.internshipId)
      if (!internship) throw new NotFoundError('Internship', q.internshipId)
      if (platformUser.role === 'student' && internship.userId !== platformUser.id) {
        throw new ForbiddenError(
          'Students may only read their own internships',
          'student_not_owner'
        )
      }
      return buildInternshipReadModel(ctx, internship)
    })
  }
}
