import type { RequestActor } from '../actor'
import type { CommandMetadata } from '../command-metadata'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { IdGenerator } from '../ports/id-generator'
import type { InternshipOfferDetails } from '../../domain/entities/internship'
import {
  ForbiddenError,
  MethodNotAllowedError,
  NotFoundError,
  PreconditionFailedError,
} from '../../domain/errors'

export interface UpdateInternshipCommand {
  actor: RequestActor
  internshipId: string
  patch: Partial<InternshipOfferDetails>
  metadata?: CommandMetadata
}

export interface UpdateInternshipResult {
  id: string
}

export class UpdateInternshipCommandHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly idGenerator: IdGenerator
  ) {}

  async handle(cmd: UpdateInternshipCommand): Promise<UpdateInternshipResult> {
    const platformUser = cmd.actor.platformUser
    if (!platformUser) {
      throw new ForbiddenError('Caller has no platform user record.', 'no_platform_user')
    }
    if (platformUser.role === 'coordinator') {
      throw new MethodNotAllowedError(
        'GET',
        'Coordinators cannot edit internships',
        'role_restricted_action'
      )
    }

    return this.uow.execute(async (ctx) => {
      const internship = await ctx.internships.findById(cmd.internshipId)
      if (!internship) throw new NotFoundError('Internship', cmd.internshipId)
      if (internship.userId !== platformUser.id) {
        throw new ForbiddenError(
          'Students may only edit their own internships',
          'student_not_owner'
        )
      }

      const expected = cmd.metadata?.expectedVersion
      if (expected !== undefined && expected !== internship.version) {
        throw new PreconditionFailedError('Resource version does not match')
      }

      internship.updateOfferDetails(
        {
          offerDate: cmd.patch.offerDate ?? internship.offerDate,
          startDate: cmd.patch.startDate ?? internship.startDate,
          endDate: Object.prototype.hasOwnProperty.call(cmd.patch, 'endDate')
            ? cmd.patch.endDate
            : internship.endDate,
        },
        this.idGenerator.next(),
        new Date()
      )
      await ctx.internships.save(internship)
      return { id: cmd.internshipId }
    })
  }
}
