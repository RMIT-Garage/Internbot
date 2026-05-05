import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { TicketResult } from '../models/ticket'
import { ForbiddenError, NotFoundError } from '../../domain/errors'

export interface GetTicketQuery {
  actor: RequestActor
  ticketId: string
}

export class GetTicketQueryHandler {
  constructor(private readonly uow: UnitOfWork) {}

  async handle(q: GetTicketQuery): Promise<TicketResult> {
    const platformUser = q.actor.platformUser
    if (!platformUser) {
      throw new ForbiddenError('Caller has no platform user record.', 'no_platform_user')
    }

    return this.uow.execute(async (ctx) => {
      const ticket = await ctx.tickets.findById(q.ticketId)
      if (!ticket) throw new NotFoundError('Ticket', q.ticketId)
      if (platformUser.role === 'student' && ticket.userId !== platformUser.id) {
        throw new ForbiddenError('Students may only read their own tickets', 'ticket_not_owner')
      }
      return { ticket }
    })
  }
}
