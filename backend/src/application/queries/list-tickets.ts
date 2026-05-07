import type { RequestActor } from '../actor'
import type { TicketQueryService } from '../ports/queries/ticket-query-service'
import type { AuthorizationService } from '../ports/authorization-service'
import type { Ticket } from '../../domain/entities/ticket'
import type { TicketListCursor, TicketListFilter } from '../read-models/ticket'
import type { TicketStatus } from '../../domain/value-objects/ticket-enums'

export interface TicketListResult {
  readonly items: readonly Ticket[]
  readonly nextPageToken: string | null
}

export interface TicketListResultWithCursor extends TicketListResult {
  readonly cursor: TicketListCursor | null
}

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
  constructor(
    private readonly ticketQueries: TicketQueryService,
    private readonly authz: AuthorizationService
  ) {}

  async handle(q: ListTicketsQuery): Promise<TicketListResultWithCursor> {
    const platformUser = this.authz.requirePlatformUser(q.actor)

    const filter: TicketListFilter = {
      userId: platformUser.role === 'student' ? platformUser.id : undefined,
      status: q.filter.status,
      limit: q.filter.limit,
      sortDirection: q.filter.sortDirection,
      cursor: q.filter.cursor,
    }
    const page = await this.ticketQueries.list(filter)
    return { items: page.items, nextPageToken: null, cursor: page.nextCursor }
  }
}
