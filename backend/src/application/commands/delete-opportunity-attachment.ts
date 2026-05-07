import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { AuthorizationService } from '../ports/authorization-service'
import { NotFoundError } from '../../domain/errors'

export interface DeleteOpportunityAttachmentCommand {
  readonly actor: RequestActor
  readonly opportunityId: string
  readonly attachmentId: string
}

/**
 * Soft-deletes an opportunity attachment via the aggregate root. The row
 * stays with a `deletedAt`/`deletedByUserId` tombstone; a future outbox
 * worker hard-deletes the GCS object out-of-band.
 */
export class DeleteOpportunityAttachmentCommandHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly authz: AuthorizationService
  ) {}

  async handle(cmd: DeleteOpportunityAttachmentCommand): Promise<void> {
    const platformUser = this.authz.requireRole(cmd.actor, 'coordinator')

    await this.uow.execute(async (ctx) => {
      const opportunity = await ctx.opportunities.findById(cmd.opportunityId)
      if (!opportunity) throw new NotFoundError('Opportunity', cmd.opportunityId)

      opportunity.softDeleteAttachment(cmd.attachmentId, platformUser.id, new Date())
      await ctx.opportunities.save(opportunity)
    })
  }
}
