import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { CommandMetadata } from '../command-metadata'
import type { AuthorizationService } from '../ports/authorization-service'
import type { WorkMode } from '../../domain/value-objects/opportunity-enums'
import { NotFoundError, PreconditionFailedError } from '../../domain/errors'

export interface UpdateOpportunityCommand {
  actor: RequestActor
  opportunityId: string
  patch: {
    employerName?: string
    jobTitle?: string
    descriptionText?: string
    workMode?: WorkMode | null
    location?: string | null
    sourceUrl?: string | null
  }
  metadata?: CommandMetadata
}

export interface UpdateOpportunityResult {
  id: string
}

export class UpdateOpportunityCommandHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly authz: AuthorizationService
  ) {}

  async handle(cmd: UpdateOpportunityCommand): Promise<UpdateOpportunityResult> {
    this.authz.requireRole(cmd.actor, 'coordinator')

    return this.uow.execute(async (ctx) => {
      const opportunity = await ctx.opportunities.findById(cmd.opportunityId)
      if (!opportunity) throw new NotFoundError('Opportunity', cmd.opportunityId)

      const expected = cmd.metadata?.expectedVersion
      if (expected !== undefined && expected !== opportunity.version) {
        throw new PreconditionFailedError('Resource version does not match')
      }

      if (cmd.patch.employerName !== undefined) {
        opportunity.changeEmployerName(cmd.patch.employerName)
      }
      if (cmd.patch.jobTitle !== undefined) {
        opportunity.changeJobTitle(cmd.patch.jobTitle)
      }
      if (cmd.patch.descriptionText !== undefined) {
        opportunity.changeDescriptionText(cmd.patch.descriptionText)
      }
      if (cmd.patch.workMode !== undefined) {
        opportunity.changeWorkMode(cmd.patch.workMode ?? undefined)
      }
      if (cmd.patch.location !== undefined) {
        opportunity.changeLocation(cmd.patch.location ?? undefined)
      }
      if (cmd.patch.sourceUrl !== undefined) {
        opportunity.changeSourceUrl(cmd.patch.sourceUrl ?? undefined)
      }

      await ctx.opportunities.save(opportunity)
      return { id: cmd.opportunityId }
    })
  }
}
