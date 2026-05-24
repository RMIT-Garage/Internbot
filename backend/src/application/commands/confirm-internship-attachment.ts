import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { AuthorizationService } from '../ports/authorization-service'
import { NotFoundError } from '../../domain/errors'

export interface ConfirmInternshipAttachmentCommand {
  readonly actor: RequestActor
  readonly internshipId: string
  readonly attachmentId: string
}

/**
 * Directly finalizes an attachment after the student's GCS PUT completes,
 * bypassing the Eventarc `OBJECT_FINALIZE` delivery path. This removes the
 * dependency on trigger cold-start latency for the interactive upload flow.
 *
 * The `syncAttachmentMetadata` worker still fires eventually and is a no-op
 * on an already-finalized attachment (idempotent). The only trade-off is that
 * `storageGeneration` is left undefined (the purge worker falls back to an
 * unconditional GCS delete, which is safe given attachment IDs are unique).
 *
 * Authorization: student must own the parent internship.
 */
export class ConfirmInternshipAttachmentCommandHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly authz: AuthorizationService
  ) {}

  async handle(cmd: ConfirmInternshipAttachmentCommand): Promise<{ id: string }> {
    this.authz.requireRole(cmd.actor, 'student')

    await this.uow.execute(async (ctx) => {
      const internship = await ctx.internships.findById(cmd.internshipId)
      if (!internship) throw new NotFoundError('Internship', cmd.internshipId)
      this.authz.requireSelfOrRole(cmd.actor, internship.userId, [], 'student_not_owner')

      const attachment = internship.attachments.find((a) => a.id === cmd.attachmentId)
      if (!attachment) throw new NotFoundError('Attachment', cmd.attachmentId)

      // No-op when already finalized — idempotent under repeated client calls
      // or concurrent Eventarc delivery.
      const changed = internship.finalizeAttachment(cmd.attachmentId, undefined, new Date())
      if (changed) {
        await ctx.internships.save(internship)
      }
    })

    return { id: cmd.internshipId }
  }
}
