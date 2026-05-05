import type { RequestActor } from '../actor'
import type { CommandMetadata } from '../command-metadata'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { IdGenerator } from '../ports/id-generator'
import type { InternshipDecisionDetails } from '../../domain/entities/internship'
import { Notification } from '../../domain/entities/notification'
import { ForbiddenError, NotFoundError, PreconditionFailedError } from '../../domain/errors'

export interface DecideInternshipOfferCommand {
  actor: RequestActor
  internshipId: string
  payload: InternshipDecisionDetails
  metadata?: CommandMetadata
}

export interface DecideInternshipOfferResult {
  id: string
}

export class DecideInternshipOfferCommandHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly idGenerator: IdGenerator
  ) {}

  async handle(cmd: DecideInternshipOfferCommand): Promise<DecideInternshipOfferResult> {
    const platformUser = cmd.actor.platformUser
    if (!platformUser) {
      throw new ForbiddenError('Caller has no platform user record.', 'no_platform_user')
    }
    if (platformUser.role !== 'coordinator') {
      throw new ForbiddenError(
        'Only coordinators may decide internship offers',
        'role_restricted_action'
      )
    }

    return this.uow.execute(async (ctx) => {
      const internship = await ctx.internships.findById(cmd.internshipId)
      if (!internship) throw new NotFoundError('Internship', cmd.internshipId)

      const expected = cmd.metadata?.expectedVersion
      if (expected !== undefined && expected !== internship.version) {
        throw new PreconditionFailedError('Resource version does not match')
      }

      const now = new Date()
      internship.decideOffer(cmd.payload, this.idGenerator.next(), platformUser.id, now)
      await ctx.internships.save(internship)
      await ctx.notifications.create(
        Notification.forOfferDecision({
          id: this.idGenerator.next(),
          userId: internship.userId,
          internshipId: internship.id,
          opportunityId: internship.opportunityId,
          decision: cmd.payload.decision,
          now,
        })
      )
      return { id: cmd.internshipId }
    })
  }
}
