import type { RequestActor } from '../actor'
import type { OpportunityQueryService } from '../ports/queries/opportunity-query-service'
import type { UserQueryService } from '../ports/queries/user-query-service'
import type { AuthorizationService } from '../ports/authorization-service'
import type { OpportunityReadModel } from '../read-models/opportunity'
import { ConflictError, ForbiddenError, NotFoundError } from '../../domain/errors'

export type OpportunityResult = OpportunityReadModel

export interface GetOpportunityQuery {
  actor: RequestActor
  opportunityId: string
}

export class GetOpportunityQueryHandler {
  constructor(
    private readonly opportunityQueries: OpportunityQueryService,
    private readonly userQueries: UserQueryService,
    private readonly authz: AuthorizationService
  ) {}

  async handle(q: GetOpportunityQuery): Promise<OpportunityResult> {
    const platformUser = this.authz.requirePlatformUser(q.actor)

    const opportunity = await this.opportunityQueries.findById(q.opportunityId)
    if (!opportunity) throw new NotFoundError('Opportunity', q.opportunityId)

    if (platformUser.role === 'student') {
      const semesterId = await this.selectedSemesterId(platformUser.id)
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
      this.opportunityQueries.countApplications(opportunity.id),
      this.opportunityQueries.listAttachments(opportunity.id),
    ])
    return { opportunity, applicationCount, attachments }
  }

  private async selectedSemesterId(userId: string): Promise<string> {
    const user = await this.userQueries.findById(userId)
    const semesterId = user?.studentProfile?.semesterId
    if (!user || user.role !== 'student' || semesterId === undefined) {
      throw new ConflictError(
        'Student has no selected semester',
        'student_has_no_selected_semester'
      )
    }
    return semesterId
  }
}
