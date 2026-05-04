import type { RequestActor } from '../actor'
import type { UnitOfWork, UnitOfWorkContext } from '../ports/unit-of-work'
import type { OpportunityResult } from '../models/opportunity'
import { ConflictError, ForbiddenError, NotFoundError } from '../../domain/errors'

export interface GetOpportunityQuery {
  actor: RequestActor
  opportunityId: string
}

export class GetOpportunityQueryHandler {
  constructor(private readonly uow: UnitOfWork) {}

  async handle(q: GetOpportunityQuery): Promise<OpportunityResult> {
    const platformUser = q.actor.platformUser
    if (!platformUser) {
      throw new ForbiddenError('Caller has no platform user record.', 'no_platform_user')
    }

    return this.uow.execute(async (ctx) => {
      const opportunity = await ctx.opportunities.findById(q.opportunityId)
      if (!opportunity) throw new NotFoundError('Opportunity', q.opportunityId)

      if (platformUser.role === 'student') {
        const semesterId = await selectedSemesterId(ctx, platformUser.id)
        const canReadPublished =
          opportunity.status === 'published' && opportunity.semesterId === semesterId
        const canReadOwnSubmission = opportunity.submittedByUserId === platformUser.id
        if (!canReadPublished && !canReadOwnSubmission) {
          throw new ForbiddenError(
            'Opportunity is not visible to this student',
            'opportunity_not_visible'
          )
        }
      }

      const [applicationCount, attachments] = await Promise.all([
        ctx.opportunities.countApplications(opportunity.id),
        ctx.opportunities.listAttachments(opportunity.id),
      ])
      return { opportunity, applicationCount, attachments }
    })
  }
}

async function selectedSemesterId(ctx: UnitOfWorkContext, userId: string): Promise<string> {
  const user = await ctx.users.findById(userId)
  const semesterId = user?.studentProfile?.semesterId
  if (!user || user.role !== 'student' || semesterId === undefined) {
    throw new ConflictError('Student has no selected semester', 'student_has_no_selected_semester')
  }
  return semesterId
}
