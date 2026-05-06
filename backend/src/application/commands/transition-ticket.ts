import type { RequestActor } from '../actor'
import type { CommandMetadata } from '../command-metadata'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { IdGenerator } from '../ports/id-generator'
import type { TicketTransitionDetails } from '../../domain/entities/ticket'
import { Notification } from '../../domain/entities/notification'
import { ForbiddenError, NotFoundError, PreconditionFailedError } from '../../domain/errors'

export interface TransitionTicketCommand {
  actor: RequestActor
  ticketId: string
  payload: TicketTransitionDetails
  metadata?: CommandMetadata
}

export interface TransitionTicketResult {
  id: string
}

export class TransitionTicketCommandHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly idGenerator: IdGenerator
  ) {}

  async handle(cmd: TransitionTicketCommand): Promise<TransitionTicketResult> {
    const platformUser = cmd.actor.platformUser
    if (!platformUser) {
      throw new ForbiddenError('Caller has no platform user record.', 'no_platform_user')
    }

    const activityId = this.idGenerator.next()
    const now = new Date()

    return this.uow.execute(async (ctx) => {
      // All reads first (Firestore txn rule: all reads before any writes).
      const ticket = await ctx.tickets.findById(cmd.ticketId)
      if (!ticket) throw new NotFoundError('Ticket', cmd.ticketId)

      const expected = cmd.metadata?.expectedVersion
      if (expected !== undefined && expected !== ticket.version) {
        throw new PreconditionFailedError('Resource version does not match')
      }

      const isOwner = ticket.userId === platformUser.id
      if (platformUser.role === 'student' && !isOwner) {
        throw new ForbiddenError(
          'Students may only transition their own tickets',
          'student_not_owner'
        )
      }

      const coordinators = platformUser.role === 'student' ? await ctx.users.listCoordinators() : []

      const fromStatus = ticket.status
      const activity = ticket.transition(
        cmd.payload,
        { userId: platformUser.id, role: platformUser.role, isOwner },
        activityId,
        now
      )
      await ctx.tickets.applyTransition(ticket, activity)

      if (platformUser.role === 'student') {
        for (const coordinator of coordinators) {
          await ctx.notifications.create(
            Notification.forTicketTransition({
              id: this.idGenerator.next(),
              userId: coordinator.id,
              ticketId: ticket.id,
              from: fromStatus,
              to: cmd.payload.to,
              now,
            })
          )
        }
      } else {
        await ctx.notifications.create(
          Notification.forTicketTransition({
            id: this.idGenerator.next(),
            userId: ticket.userId,
            ticketId: ticket.id,
            from: fromStatus,
            to: cmd.payload.to,
            now,
          })
        )
      }

      return { id: ticket.id }
    })
  }
}
