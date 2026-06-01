import type { RequestActor } from '../actor'
import type { InternshipQueryService } from '../ports/queries/internship-query-service'
import type { OpportunityQueryService } from '../ports/queries/opportunity-query-service'
import type { UserQueryService } from '../ports/queries/user-query-service'
import type { SemesterQueryService } from '../ports/queries/semester-query-service'
import type { AuthorizationService } from '../ports/authorization-service'
import type { InternshipReadModel } from '../read-models/internship'
import { NotFoundError } from '../../domain/errors'
import { buildInternshipReadModel } from '../read-models/internship'

export type InternshipResult = InternshipReadModel

export interface GetInternshipQuery {
  actor: RequestActor
  internshipId: string
}

export class GetInternshipQueryHandler {
  constructor(
    private readonly internshipQueries: InternshipQueryService,
    private readonly opportunityQueries: OpportunityQueryService,
    private readonly userQueries: UserQueryService,
    private readonly semesterQueries: SemesterQueryService,
    private readonly authz: AuthorizationService
  ) {}

  async handle(q: GetInternshipQuery): Promise<InternshipResult> {
    const internship = await this.internshipQueries.findById(q.internshipId)
    if (!internship) throw new NotFoundError('Internship', q.internshipId)

    this.authz.requireSelfOrRole(q.actor, internship.userId, 'coordinator', 'student_not_owner')

    return buildInternshipReadModel(
      {
        users: this.userQueries,
        opportunities: this.opportunityQueries,
        internships: this.internshipQueries,
        semesters: this.semesterQueries,
      },
      internship
    )
  }
}
