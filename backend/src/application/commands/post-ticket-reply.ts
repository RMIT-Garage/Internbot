import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { IdGenerator } from '../ports/id-generator'
import type { TicketReplyResult } from '../models/ticket'
import { Notification } from '../../domain/entities/notification'
import { ForbiddenError, NotFoundError } from '../../domain/errors'

export interface PostTicketReplyCommand {
  actor: RequestActor
  ticketId: string
  text: string
}

export class PostTicketReplyCommandHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly idGenerator: IdGenerator
  ) {}

  async handle(cmd: PostTicketReplyCommand): Promise<TicketReplyResult> {
    const platformUser = cmd.actor.platformUser
    if (!platformUser) {
      throw new ForbiddenError('Caller has no platform user record.', 'no_platform_user')
    }

    const replyId = this.idGenerator.next()
    const now = new Date()

    return this.uow.execute(async (ctx) => {
      // All reads first (Firestore txn rule: all reads before any writes).
      const ticket = await ctx.tickets.findById(cmd.ticketId)
      if (!ticket) throw new NotFoundError('Ticket', cmd.ticketId)

      const isOwner = ticket.userId === platformUser.id
      if (platformUser.role === 'student' && !isOwner) {
        throw new ForbiddenError(
          'Students may only reply to their own tickets',
          'student_not_owner'
        )
      }

      const coordinators = platformUser.role === 'student' ? await ctx.users.listCoordinators() : []

      const reply = ticket.reply(
        replyId,
        { userId: platformUser.id, role: platformUser.role, isOwner },
        cmd.text,
        now
      )
      await ctx.tickets.addReply(ticket.id, reply, now)

      if (platformUser.role === 'student') {
        for (const coordinator of coordinators) {
          await ctx.notifications.create(
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
        await ctx.notifications.create(
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
