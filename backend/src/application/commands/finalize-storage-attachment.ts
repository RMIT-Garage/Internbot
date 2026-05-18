import type { UnitOfWork } from '../ports/unit-of-work'
import { parseAttachmentStoragePath } from '../../domain/value-objects/attachment-storage-path'

export interface FinalizeStorageAttachmentCommand {
  readonly filePath: string
  readonly finalizedAt: Date | undefined
  /**
   * GCS object generation from the OBJECT_FINALIZE event. Persisted on the
   * Firestore attachment doc so the outbox-driven purge worker can issue
   * the GCS delete with `ifGenerationMatch` and avoid clobbering a re-upload
   * that happened after the user requested removal.
   */
  readonly generation: string | undefined
}

export interface FinalizeStorageAttachmentResult {
  readonly finalized: boolean
  readonly reason:
    | 'finalized'
    | 'already_finalized'
    | 'invalid_path'
    | 'parent_not_found'
    | 'attachment_not_found'
    | 'prefix_owner_mismatch'
    | 'empty_object_name'
}

/**
 * Transitions an attachment from `uploading` → `finalized` after the Cloud
 * Storage `OBJECT_FINALIZE` event confirms the client's signed-URL PUT
 * succeeded. The attachment row was pre-written by the upload-intent
 * endpoint; this handler only flips state + records the GCS generation.
 *
 * Idempotent under event redelivery: a second finalize for the same
 * attachment returns `already_finalized` without writing.
 *
 * Logical failures (unknown path, parent missing, attachment missing) are
 * absorbed here so the Eventarc subscription does not infinitely retry. The
 * caller should still surface transient infra errors so Pub/Sub redelivers.
 */
export class FinalizeStorageAttachmentCommandHandler {
  constructor(private readonly uow: UnitOfWork) {}

  async handle(cmd: FinalizeStorageAttachmentCommand): Promise<FinalizeStorageAttachmentResult> {
    if (cmd.filePath.trim().length === 0) {
      return { finalized: false, reason: 'empty_object_name' }
    }

    const parsed = parseAttachmentStoragePath(cmd.filePath)
    if (!parsed) return { finalized: false, reason: 'invalid_path' }

    const finalizedAt = cmd.finalizedAt ?? new Date()

    if (parsed.kind === 'opportunity') {
      return this.uow.execute(async (ctx) => {
        const opportunity = await ctx.opportunities.findById(parsed.opportunityId)
        if (!opportunity) return { finalized: false, reason: 'parent_not_found' } as const
        const existing = opportunity.attachments.find((a) => a.id === parsed.attachmentId)
        if (!existing || existing.filePath !== cmd.filePath) {
          return { finalized: false, reason: 'attachment_not_found' } as const
        }
        const changed = opportunity.finalizeAttachment(
          parsed.attachmentId,
          cmd.generation,
          finalizedAt
        )
        if (!changed) return { finalized: false, reason: 'already_finalized' } as const
        await ctx.opportunities.save(opportunity)
        return { finalized: true, reason: 'finalized' } as const
      })
    }

    return this.uow.execute(async (ctx) => {
      const internship = await ctx.internships.findById(parsed.internshipId)
      if (!internship) return { finalized: false, reason: 'parent_not_found' } as const
      if (internship.userId !== parsed.userId) {
        return { finalized: false, reason: 'prefix_owner_mismatch' } as const
      }
      const existing = internship.attachments.find((a) => a.id === parsed.attachmentId)
      if (!existing || existing.filePath !== cmd.filePath) {
        return { finalized: false, reason: 'attachment_not_found' } as const
      }
      const changed = internship.finalizeAttachment(
        parsed.attachmentId,
        cmd.generation,
        finalizedAt
      )
      if (!changed) return { finalized: false, reason: 'already_finalized' } as const
      await ctx.internships.save(internship)
      return { finalized: true, reason: 'finalized' } as const
    })
  }
}
