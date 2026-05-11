import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { CommandMetadata } from '../command-metadata'
import type { OpportunityTransitionTarget } from '../../domain/value-objects/opportunity-enums'
import { ForbiddenError, NotFoundError, PreconditionFailedError } from '../../domain/errors'

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
  constructor(private readonly uow: UnitOfWork) {}

  async handle(cmd: TransitionOpportunityCommand): Promise<TransitionOpportunityResult> {
    const platformUser = cmd.actor.platformUser
    if (!platformUser) {
      throw new ForbiddenError('Caller has no platform user record.', 'no_platform_user')
    }
    if (platformUser.role !== 'coordinator') {
      throw new ForbiddenError(
        'Only coordinators may transition opportunities',
        'role_restricted_action'
      )
    }

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
