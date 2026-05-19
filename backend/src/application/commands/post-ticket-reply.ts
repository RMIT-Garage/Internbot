import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { IdGenerator } from '../ports/id-generator'
import type { AuthorizationService } from '../ports/authorization-service'
import type { TicketReply } from '../../domain/value-objects/ticket-reply'
import { Notification } from '../../domain/entities/notification'
import { NotFoundError } from '../../domain/errors'

export interface TicketReplyResult {
  readonly reply: TicketReply
}

export interface PostTicketReplyCommand {
  actor: RequestActor
  ticketId: string
  text: string
}

export class PostTicketReplyCommandHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly authz: AuthorizationService,
    private readonly idGenerator: IdGenerator
  ) {}

  async handle(cmd: PostTicketReplyCommand): Promise<TicketReplyResult> {
    this.authz.requirePlatformUser(cmd.actor)

    const replyId = this.idGenerator.next()
    const now = new Date()

    return this.uow.execute(async (ctx) => {
      const ticket = await ctx.tickets.findById(cmd.ticketId)
      if (!ticket) throw new NotFoundError('Ticket', cmd.ticketId)

      const platformUser = this.authz.requireSelfOrRole(
        cmd.actor,
        ticket.userId,
        ['coordinator'],
        'student_not_owner'
      )
      const isOwner = ticket.userId === platformUser.id

      // Reads-before-writes: load coordinators in-txn for student fan-out.
      const coordinators = platformUser.role === 'student' ? await ctx.users.listCoordinators() : []

      const reply = ticket.addReply(
        replyId,
        { userId: platformUser.id, role: platformUser.role, isOwner },
        cmd.text,
        now
      )
      await ctx.tickets.save(ticket)

      if (platformUser.role === 'student') {
        for (const coordinator of coordinators) {
          await ctx.notifications.save(
            Notification.forTicketReply({
              id: this.idGenerator.next(),
              userId: coordinator.id,
              ticketId: ticket.id,
              replierRole: 'student',
              now,
            })
          )
        }
      } else {
        await ctx.notifications.save(
          Notification.forTicketReply({
            id: this.idGenerator.next(),
            userId: ticket.userId,
            ticketId: ticket.id,
            replierRole: 'coordinator',
            now,
          })
        )
      }

      return { reply }
    })
  }
}
