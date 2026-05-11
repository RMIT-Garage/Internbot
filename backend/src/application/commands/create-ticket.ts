import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { IdGenerator } from '../ports/id-generator'
import { Notification } from '../../domain/entities/notification'
import { Ticket } from '../../domain/entities/ticket'
import { ForbiddenError } from '../../domain/errors'

export interface CreateTicketCommand {
  actor: RequestActor
  payload: {
    subject: string
    body: string
    category: string | undefined
  }
}

export interface CreateTicketResult {
  id: string
}

export class CreateTicketCommandHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly idGenerator: IdGenerator
  ) {}

  async handle(cmd: CreateTicketCommand): Promise<CreateTicketResult> {
    const platformUser = cmd.actor.platformUser
    if (!platformUser) {
      throw new ForbiddenError('Caller has no platform user record.', 'no_platform_user')
    }
    if (platformUser.role !== 'student') {
      throw new ForbiddenError('Only students may open tickets', 'role_restricted_action')
    }

    const ticketId = this.idGenerator.next()
    const now = new Date()

    return this.uow.execute(async (ctx) => {
      // Read first (Firestore txn rule: all reads before any writes).
      const coordinators = await ctx.users.listCoordinators()

      const ticket = Ticket.open({
        id: ticketId,
        userId: platformUser.id,
        subject: cmd.payload.subject,
        body: cmd.payload.body,
        category: cmd.payload.category,
        now,
      })
      await ctx.tickets.create(ticket)

      for (const coordinator of coordinators) {
        await ctx.notifications.create(
          Notification.forNewTicket({
            id: this.idGenerator.next(),
            userId: coordinator.id,
            ticketId: ticket.id,
            subject: ticket.subject,
            now,
          })
        )
      }

      return { id: ticketId }
    })
  }
}
