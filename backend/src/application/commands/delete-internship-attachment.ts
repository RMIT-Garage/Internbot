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
 * Hard-deletes an internship attachment via the aggregate root. The repo
 * removes the Firestore subdoc and writes an `attachmentPurgeQueue` outbox
 * row in the same transaction. A separate worker drains the queue and
 * deletes the GCS object asynchronously.
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

      internship.removeAttachment(cmd.attachmentId, platformUser.id, new Date())
      await ctx.internships.save(internship)
    })
  }
}
