import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { CommandMetadata } from '../command-metadata'
import type { AuthorizationService } from '../ports/authorization-service'
import type { OpportunityTransitionTarget } from '../../domain/value-objects/opportunity-enums'
import { NotFoundError, PreconditionFailedError } from '../../domain/errors'

export interface TransitionOpportunityCommand {
  actor: RequestActor
  opportunityId: string
  to: OpportunityTransitionTarget
  comment: string | undefined
  metadata?: CommandMetadata
}

export interface TransitionOpportunityResult {
  id: string
}

export class TransitionOpportunityCommandHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly authz: AuthorizationService
  ) {}

  async handle(cmd: TransitionOpportunityCommand): Promise<TransitionOpportunityResult> {
    const platformUser = this.authz.requireRole(cmd.actor, 'coordinator')

    return this.uow.execute(async (ctx) => {
      const opportunity = await ctx.opportunities.findById(cmd.opportunityId)
      if (!opportunity) throw new NotFoundError('Opportunity', cmd.opportunityId)

      const expected = cmd.metadata?.expectedVersion
      if (expected !== undefined && expected !== opportunity.version) {
        throw new PreconditionFailedError('Resource version does not match')
      }

      opportunity.applyTransition(cmd.to, platformUser.id, cmd.comment, new Date())
      await ctx.opportunities.save(opportunity)
      return { id: cmd.opportunityId }
    })
  }
}
