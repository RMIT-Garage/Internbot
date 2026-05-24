import type { RequestActor } from '../actor'
import type { OpportunityQueryService } from '../ports/queries/opportunity-query-service'
import type { UserQueryService } from '../ports/queries/user-query-service'
import type { AuthorizationService } from '../ports/authorization-service'
import type {
  OpportunityListCursor,
  OpportunityListFilter,
  OpportunityReadModel,
} from '../read-models/opportunity'
import type {
  OpportunityStatus,
  OpportunityType,
} from '../../domain/value-objects/opportunity-enums'
import { ConflictError, InvalidQueryError } from '../../domain/errors'

export interface OpportunityListResult {
  items: readonly OpportunityReadModel[]
  nextPageToken: string | null
}

export interface OpportunityListResultWithCursor extends OpportunityListResult {
  cursor: OpportunityListCursor | null
}

export interface ListOpportunitiesQuery {
  actor: RequestActor
  filter: {
    semesterId: string | undefined
    status: readonly OpportunityStatus[] | undefined
    type: OpportunityType | undefined
    limit: number
    sortField: 'createdAt'
    sortDirection: 'asc' | 'desc'
    cursor: OpportunityListCursor | undefined
  }
}

export class ListOpportunitiesQueryHandler {
  constructor(
    private readonly opportunityQueries: OpportunityQueryService,
    private readonly userQueries: UserQueryService,
    private readonly authz: AuthorizationService
  ) {}

  async handle(q: ListOpportunitiesQuery): Promise<OpportunityListResultWithCursor> {
    const platformUser = this.authz.requirePlatformUser(q.actor)

    const filter =
      platformUser.role === 'student'
        ? await this.studentFilter(platformUser.id, q.filter)
        : coordinatorFilter(q.filter)

    const page = await this.opportunityQueries.list(filter)
    const items = await Promise.all(
      page.items.map(async (opportunity) => ({
        opportunity,
        applicationCount: await this.opportunityQueries.countApplications(opportunity.id),
        attachments: await this.opportunityQueries.listAttachments(opportunity.id),
      }))
    )

    return { items, nextPageToken: null, cursor: page.nextCursor }
  }

  private async studentFilter(
    userId: string,
    requested: ListOpportunitiesQuery['filter']
  ): Promise<OpportunityListFilter> {
    const user = await this.userQueries.findById(userId)
    const semesterId = user?.studentProfile?.semesterId
    if (!user || user.role !== 'student' || semesterId === undefined) {
      throw new ConflictError(
        'Student has no selected semester',
        'student_has_no_selected_semester'
      )
    }
    if (requested.semesterId !== undefined && requested.semesterId !== semesterId) {
      throw new InvalidQueryError('Students cannot query another semester', 'invalid_query', [
        {
          field: 'semesterId',
          code: 'not_allowed',
          message: 'semesterId must match the student selected semester',
        },
      ])
    }

    return {
      semesterId,
      status: ['published'],
      type: requested.type,
      limit: requested.limit,
      sortField: requested.sortField,
      sortDirection: requested.sortDirection,
      cursor: requested.cursor,
      submittedByUserId: userId,
    }
  }
}

function coordinatorFilter(filter: ListOpportunitiesQuery['filter']): OpportunityListFilter {
  return filter
}
