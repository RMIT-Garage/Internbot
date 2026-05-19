import type { RequestActor } from '../actor'
import type { InternshipQueryService } from '../ports/queries/internship-query-service'
import type { OpportunityQueryService } from '../ports/queries/opportunity-query-service'
import type { UserQueryService } from '../ports/queries/user-query-service'
import type { AuthorizationService } from '../ports/authorization-service'
import type {
  InternshipListCursor,
  InternshipListFilter,
  InternshipReadModel,
} from '../read-models/internship'
import type { InternshipStatus } from '../../domain/value-objects/internship-enums'
import { InvalidQueryError } from '../../domain/errors'
import { buildInternshipReadModel } from '../read-models/internship'

export interface InternshipListResult {
  items: readonly InternshipReadModel[]
  nextPageToken: string | null
}

export interface InternshipListResultWithCursor extends InternshipListResult {
  cursor: InternshipListCursor | null
}

export interface ListInternshipsQuery {
  actor: RequestActor
  filter: {
    userId: string | undefined
    opportunityId: string | undefined
    status: readonly InternshipStatus[] | undefined
    limit: number
    sortField: 'createdAt' | 'lastSubmittedAt'
    sortDirection: 'asc' | 'desc'
    cursor: InternshipListCursor | undefined
  }
}

export class ListInternshipsQueryHandler {
  constructor(
    private readonly internshipQueries: InternshipQueryService,
    private readonly opportunityQueries: OpportunityQueryService,
    private readonly userQueries: UserQueryService,
    private readonly authz: AuthorizationService
  ) {}

  async handle(q: ListInternshipsQuery): Promise<InternshipListResultWithCursor> {
    const platformUser = this.authz.requirePlatformUser(q.actor)

    const filter =
      platformUser.role === 'student'
        ? studentFilter(platformUser.id, q.filter)
        : coordinatorFilter(q.filter)

    const page = await this.internshipQueries.list(filter)
    const deps = {
      users: this.userQueries,
      opportunities: this.opportunityQueries,
      internships: this.internshipQueries,
    }
    const items = await Promise.all(
      page.items.map((internship) => buildInternshipReadModel(deps, internship))
    )
    return { items, nextPageToken: null, cursor: page.nextCursor }
  }
}

function coordinatorFilter(filter: ListInternshipsQuery['filter']): InternshipListFilter {
  return filter
}

function studentFilter(
  userId: string,
  requested: ListInternshipsQuery['filter']
): InternshipListFilter {
  if (requested.userId !== undefined && requested.userId !== userId) {
    throw new InvalidQueryError('Students cannot query another user', 'invalid_query', [
      {
        field: 'userId',
        code: 'not_allowed',
        message: 'userId must match the authenticated student',
      },
    ])
  }

  return {
    userId,
    opportunityId: requested.opportunityId,
    status: requested.status,
    limit: requested.limit,
    sortField: requested.sortField,
    sortDirection: requested.sortDirection,
    cursor: requested.cursor,
  }
}
