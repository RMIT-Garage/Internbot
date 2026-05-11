import type { RequestActor } from '../actor'
import type { UnitOfWork, UnitOfWorkContext } from '../ports/unit-of-work'
import type { OpportunityListResultWithCursor } from '../models/opportunity'
import type {
  OpportunityListCursor,
  OpportunityListFilter,
} from '../../domain/repositories/opportunity-repository'
import type {
  OpportunityStatus,
  OpportunityType,
} from '../../domain/value-objects/opportunity-enums'
import { ConflictError, ForbiddenError, InvalidQueryError } from '../../domain/errors'

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
  constructor(private readonly uow: UnitOfWork) {}

  async handle(q: ListOpportunitiesQuery): Promise<OpportunityListResultWithCursor> {
    const platformUser = q.actor.platformUser
    if (!platformUser) {
      throw new ForbiddenError('Caller has no platform user record.', 'no_platform_user')
    }

    return this.uow.execute(async (ctx) => {
      const filter =
        platformUser.role === 'student'
          ? await studentFilter(ctx, platformUser.id, q.filter)
          : coordinatorFilter(q.filter)

      const page = await ctx.opportunities.list(filter)
      const items = await Promise.all(
        page.items.map(async (opportunity) => ({
          opportunity,
          applicationCount: await ctx.opportunities.countApplications(opportunity.id),
          attachments: await ctx.opportunities.listAttachments(opportunity.id),
        }))
      )

      return { items, nextPageToken: null, cursor: page.nextCursor }
    })
  }
}

function coordinatorFilter(filter: ListOpportunitiesQuery['filter']): OpportunityListFilter {
  return filter
}

async function studentFilter(
  ctx: UnitOfWorkContext,
  userId: string,
  requested: ListOpportunitiesQuery['filter']
): Promise<OpportunityListFilter> {
  const user = await ctx.users.findById(userId)
  const semesterId = user?.studentProfile?.semesterId
  if (!user || user.role !== 'student' || semesterId === undefined) {
    throw new ConflictError('Student has no selected semester', 'student_has_no_selected_semester')
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
  }
}
