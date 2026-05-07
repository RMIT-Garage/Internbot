import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { IdGenerator } from '../ports/id-generator'
import type { CommandMetadata } from '../command-metadata'
import type { AuthorizationService } from '../ports/authorization-service'
import type { OpportunityVerificationDecision } from '../../domain/value-objects/opportunity-enums'
import { Notification } from '../../domain/entities/notification'
import { NotFoundError, PreconditionFailedError } from '../../domain/errors'

export interface VerifyOpportunityCommand {
  actor: RequestActor
  opportunityId: string
  decision: OpportunityVerificationDecision
  comment: string | undefined
  metadata?: CommandMetadata
}

export interface VerifyOpportunityResult {
  id: string
}

export class VerifyOpportunityCommandHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly authz: AuthorizationService,
    private readonly idGenerator: IdGenerator
  ) {}

  async handle(cmd: VerifyOpportunityCommand): Promise<VerifyOpportunityResult> {
    const platformUser = this.authz.requireRole(cmd.actor, 'coordinator')

    return this.uow.execute(async (ctx) => {
      const opportunity = await ctx.opportunities.findById(cmd.opportunityId)
      if (!opportunity) throw new NotFoundError('Opportunity', cmd.opportunityId)

      const expected = cmd.metadata?.expectedVersion
      if (expected !== undefined && expected !== opportunity.version) {
        throw new PreconditionFailedError('Resource version does not match')
      }

      const now = new Date()
      opportunity.verify(cmd.decision, platformUser.id, cmd.comment, now)
      await ctx.opportunities.save(opportunity)
      if (opportunity.submittedByUserId !== undefined) {
        await ctx.notifications.save(
          Notification.forOpportunityVerification({
            id: this.idGenerator.next(),
            userId: opportunity.submittedByUserId,
            opportunityId: opportunity.id,
            approved: cmd.decision === 'approved',
            now,
          })
        )
      }
      return { id: cmd.opportunityId }
    })
  }
}
