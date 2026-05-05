import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { InternshipListResultWithCursor } from '../models/internship'
import type {
  InternshipListCursor,
  InternshipListFilter,
} from '../../domain/repositories/internship-repository'
import type { InternshipStatus } from '../../domain/value-objects/internship-enums'
import { ForbiddenError, InvalidQueryError } from '../../domain/errors'
import { buildInternshipReadModel } from './internship-read-model'

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
  constructor(private readonly uow: UnitOfWork) {}

  async handle(q: ListInternshipsQuery): Promise<InternshipListResultWithCursor> {
    const platformUser = q.actor.platformUser
    if (!platformUser) {
      throw new ForbiddenError('Caller has no platform user record.', 'no_platform_user')
    }

    return this.uow.execute(async (ctx) => {
      const filter =
        platformUser.role === 'student'
          ? studentFilter(platformUser.id, q.filter)
          : coordinatorFilter(q.filter)

      const page = await ctx.internships.list(filter)
      const items = await Promise.all(
        page.items.map((internship) => buildInternshipReadModel(ctx, internship))
      )
      return { items, nextPageToken: null, cursor: page.nextCursor }
    })
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
