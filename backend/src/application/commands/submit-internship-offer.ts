import type { RequestActor } from '../actor'
import type { CommandMetadata } from '../command-metadata'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { IdGenerator } from '../ports/id-generator'
import type { InternshipOfferSubmissionDetails } from '../../domain/entities/internship'
import { ForbiddenError, NotFoundError, PreconditionFailedError } from '../../domain/errors'

export interface SubmitInternshipOfferCommand {
  actor: RequestActor
  internshipId: string
  payload: InternshipOfferSubmissionDetails
  metadata?: CommandMetadata
}

export interface SubmitInternshipOfferResult {
  id: string
}

export class SubmitInternshipOfferCommandHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly idGenerator: IdGenerator
  ) {}

  async handle(cmd: SubmitInternshipOfferCommand): Promise<SubmitInternshipOfferResult> {
    const platformUser = cmd.actor.platformUser
    if (!platformUser) {
      throw new ForbiddenError('Caller has no platform user record.', 'no_platform_user')
    }
    if (platformUser.role !== 'student') {
      throw new ForbiddenError('Only student owners may submit offers', 'role_restricted_action')
    }

    return this.uow.execute(async (ctx) => {
      const internship = await ctx.internships.findById(cmd.internshipId)
      if (!internship) throw new NotFoundError('Internship', cmd.internshipId)
      if (internship.userId !== platformUser.id) {
        throw new ForbiddenError(
          'Students may only submit their own internships',
          'student_not_owner'
        )
      }

      const expected = cmd.metadata?.expectedVersion
      if (expected !== undefined && expected !== internship.version) {
        throw new PreconditionFailedError('Resource version does not match')
      }

      const hasAttachments = await ctx.internships.hasAttachments(internship.id)
      internship.submitOffer(cmd.payload, this.idGenerator.next(), new Date(), hasAttachments)
      await ctx.internships.save(internship)
      return { id: cmd.internshipId }
    })
  }
}
