import type { RequestActor } from '../actor'
import type { CommandMetadata } from '../command-metadata'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { IdGenerator } from '../ports/id-generator'
import type { AuthorizationService } from '../ports/authorization-service'
import type { InternshipOfferSubmissionDetails } from '../../domain/entities/internship'
import { NotFoundError, PreconditionFailedError } from '../../domain/errors'

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
    private readonly authz: AuthorizationService,
    private readonly idGenerator: IdGenerator
  ) {}

  async handle(cmd: SubmitInternshipOfferCommand): Promise<SubmitInternshipOfferResult> {
    this.authz.requireRole(cmd.actor, 'student')

    return this.uow.execute(async (ctx) => {
      const internship = await ctx.internships.findById(cmd.internshipId)
      if (!internship) throw new NotFoundError('Internship', cmd.internshipId)
      this.authz.requireSelfOrRole(cmd.actor, internship.userId, [], 'student_not_owner')

      const expected = cmd.metadata?.expectedVersion
      if (expected !== undefined && expected !== internship.version) {
        throw new PreconditionFailedError('Resource version does not match')
      }

      internship.submitOffer(
        cmd.payload,
        this.idGenerator.next(),
        new Date(),
        internship.hasActiveAttachments()
      )
      await ctx.internships.save(internship)
      return { id: cmd.internshipId }
    })
  }
}
