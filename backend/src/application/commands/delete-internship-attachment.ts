import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { AuthorizationService } from '../ports/authorization-service'
import { NotFoundError } from '../../domain/errors'

export interface DeleteInternshipAttachmentCommand {
  readonly actor: RequestActor
  readonly internshipId: string
  readonly attachmentId: string
}

/**
 * Soft-deletes an internship attachment via the aggregate root. The
 * attachment row stays in Firestore with a `deletedAt`/`deletedByUserId`
 * tombstone so the read-side stops returning it; a future outbox-driven
 * worker will hard-delete the GCS object asynchronously.
 */
export class DeleteInternshipAttachmentCommandHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly authz: AuthorizationService
  ) {}

  async handle(cmd: DeleteInternshipAttachmentCommand): Promise<void> {
    this.authz.requireRole(cmd.actor, 'student')

    await this.uow.execute(async (ctx) => {
      const internship = await ctx.internships.findById(cmd.internshipId)
      if (!internship) throw new NotFoundError('Internship', cmd.internshipId)
      const platformUser = this.authz.requireSelfOrRole(
        cmd.actor,
        internship.userId,
        [],
        'student_not_owner'
      )

      internship.softDeleteAttachment(cmd.attachmentId, platformUser.id, new Date())
      await ctx.internships.save(internship)
    })
  }
}
