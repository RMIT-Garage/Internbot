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
 * Hard-deletes an opportunity attachment via the aggregate root. The repo
 * removes the Firestore subdoc and writes an `attachmentPurgeQueue` outbox
 * row in the same transaction. A separate worker drains the queue and
 * deletes the GCS object asynchronously.
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

      opportunity.removeAttachment(cmd.attachmentId, platformUser.id, new Date())
      await ctx.opportunities.save(opportunity)
    })
  }
}
