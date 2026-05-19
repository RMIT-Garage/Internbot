import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { IdGenerator } from '../ports/id-generator'
import type { AuthorizationService } from '../ports/authorization-service'
import { Notification } from '../../domain/entities/notification'
import { Ticket } from '../../domain/entities/ticket'

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
    private readonly authz: AuthorizationService,
    private readonly idGenerator: IdGenerator
  ) {}

  async handle(cmd: CreateTicketCommand): Promise<CreateTicketResult> {
    const platformUser = this.authz.requireRole(cmd.actor, 'student')

    const ticketId = this.idGenerator.next()
    const now = new Date()

    return this.uow.execute(async (ctx) => {
      // Firestore transactions require all reads before any writes — load
      // the coordinator recipient set first, then perform the saves.
      const coordinators = await ctx.users.listCoordinators()

      const ticket = Ticket.open({
        id: ticketId,
        userId: platformUser.id,
        subject: cmd.payload.subject,
        body: cmd.payload.body,
        category: cmd.payload.category,
        now,
      })
      await ctx.tickets.save(ticket)

      for (const coordinator of coordinators) {
        await ctx.notifications.save(
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
