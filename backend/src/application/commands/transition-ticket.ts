import type { RequestActor } from '../actor'
import type { CommandMetadata } from '../command-metadata'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { IdGenerator } from '../ports/id-generator'
import type { AuthorizationService } from '../ports/authorization-service'
import type { TicketTransitionDetails } from '../../domain/entities/ticket'
import type { TicketActivity } from '../../domain/value-objects/ticket-activity'
import { Notification } from '../../domain/entities/notification'
import { NotFoundError, PreconditionFailedError } from '../../domain/errors'

export interface TicketActivityResult {
  readonly activity: TicketActivity
}

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
    private readonly authz: AuthorizationService,
    private readonly idGenerator: IdGenerator
  ) {}

  async handle(cmd: TransitionTicketCommand): Promise<TransitionTicketResult> {
    this.authz.requirePlatformUser(cmd.actor)

    const activityId = this.idGenerator.next()
    const now = new Date()

    return this.uow.execute(async (ctx) => {
      const ticket = await ctx.tickets.findById(cmd.ticketId)
      if (!ticket) throw new NotFoundError('Ticket', cmd.ticketId)

      const expected = cmd.metadata?.expectedVersion
      if (expected !== undefined && expected !== ticket.version) {
        throw new PreconditionFailedError('Resource version does not match')
      }

      const platformUser = this.authz.requireSelfOrRole(
        cmd.actor,
        ticket.userId,
        ['coordinator'],
        'student_not_owner'
      )
      const isOwner = ticket.userId === platformUser.id

      // Reads-before-writes: load coordinators in-txn for student fan-out.
      const coordinators = platformUser.role === 'student' ? await ctx.users.listCoordinators() : []

      const fromStatus = ticket.status
      ticket.transition(
        cmd.payload,
        { userId: platformUser.id, role: platformUser.role, isOwner },
        activityId,
        now
      )
      await ctx.tickets.save(ticket)

      if (platformUser.role === 'student') {
        for (const coordinator of coordinators) {
          await ctx.notifications.save(
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
        await ctx.notifications.save(
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
