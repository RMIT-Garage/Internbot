import type { RequestActor } from '../actor'
import type { TicketQueryService } from '../ports/queries/ticket-query-service'
import type { AuthorizationService } from '../ports/authorization-service'
import type { Ticket } from '../../domain/entities/ticket'
import type { TicketReply } from '../../domain/value-objects/ticket-reply'
import { NotFoundError } from '../../domain/errors'

export interface TicketResult {
  readonly ticket: Ticket
  readonly replies: readonly TicketReply[]
}

export interface GetTicketQuery {
  actor: RequestActor
  ticketId: string
}

export class GetTicketQueryHandler {
  constructor(
    private readonly ticketQueries: TicketQueryService,
    private readonly authz: AuthorizationService
  ) {}

  async handle(q: GetTicketQuery): Promise<TicketResult> {
    // requirePlatformUser before findById so an unhydrated caller hits a
    // 403 `no_platform_user` rather than leaking 404 / existence info.
    this.authz.requirePlatformUser(q.actor)

    const result = await this.ticketQueries.findById(q.ticketId)
    if (!result) throw new NotFoundError('Ticket', q.ticketId)

    this.authz.requireSelfOrRole(q.actor, result.ticket.userId, 'coordinator', 'ticket_not_owner')

    return { ticket: result.ticket, replies: result.replies }
  }
}
