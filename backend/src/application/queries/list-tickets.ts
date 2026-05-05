import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { TicketListResultWithCursor } from '../models/ticket'
import type {
  TicketListCursor,
  TicketListFilter,
} from '../../domain/repositories/ticket-repository'
import type { TicketStatus } from '../../domain/value-objects/ticket-enums'
import { ForbiddenError } from '../../domain/errors'

export interface ListTicketsQuery {
  actor: RequestActor
  filter: {
    status: TicketStatus | undefined
    limit: number
    sortDirection: 'asc' | 'desc'
    cursor: TicketListCursor | undefined
  }
}

export class ListTicketsQueryHandler {
  constructor(private readonly uow: UnitOfWork) {}

  async handle(q: ListTicketsQuery): Promise<TicketListResultWithCursor> {
    const platformUser = q.actor.platformUser
    if (!platformUser) {
      throw new ForbiddenError('Caller has no platform user record.', 'no_platform_user')
    }

    return this.uow.execute(async (ctx) => {
      const filter: TicketListFilter = {
        userId: platformUser.role === 'student' ? platformUser.id : undefined,
        status: q.filter.status,
        limit: q.filter.limit,
        sortDirection: q.filter.sortDirection,
        cursor: q.filter.cursor,
      }
      const page = await ctx.tickets.list(filter)
      return { items: page.items, nextPageToken: null, cursor: page.nextCursor }
    })
  }
}
