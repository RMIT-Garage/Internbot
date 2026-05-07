import { createHash } from 'node:crypto'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { AttachmentStorage } from '../ports/attachment-storage'
import { Attachment } from '../../domain/value-objects/attachment'
import { parseAttachmentStoragePath } from '../../domain/value-objects/attachment-storage-path'

export interface SyncStorageAttachmentCommand {
  readonly filePath: string
  readonly contentType: string | undefined
  readonly finalizedAt: Date | undefined
  /**
   * GCS object generation from the OBJECT_FINALIZE event. Persisted on the
   * Firestore attachment doc so the future outbox-driven hard-delete worker
   * can issue the GCS delete with `ifGenerationMatch` and avoid clobbering
   * a re-upload that happened after the soft-delete. Optional only because
   * some legacy event shapes / tests omit it; new uploads always populate it.
   */
  readonly generation: string | undefined
}

export interface SyncStorageAttachmentResult {
  readonly reflected: boolean
  readonly reason:
    | 'synced'
    | 'invalid_path'
    | 'parent_not_found'
    | 'prefix_owner_mismatch'
    | 'empty_object_name'
}

export class SyncStorageAttachmentCommandHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly attachmentStorage: AttachmentStorage
  ) {}

  async handle(cmd: SyncStorageAttachmentCommand): Promise<SyncStorageAttachmentResult> {
    if (cmd.filePath.trim().length === 0) {
      return { reflected: false, reason: 'empty_object_name' }
    }

    const parsed = parseAttachmentStoragePath(cmd.filePath)
    if (!parsed) {
      await this.attachmentStorage.deleteObject(cmd.filePath)
      return { reflected: false, reason: 'invalid_path' }
    }

    const attachment = Attachment.create({
      id: attachmentIdForFilePath(cmd.filePath),
      filePath: cmd.filePath,
      fileName: parsed.fileName,
      contentType: normalizeOptionalText(cmd.contentType),
      uploadedAt: cmd.finalizedAt ?? new Date(),
      storageGeneration: cmd.generation,
      deletedAt: undefined,
      deletedByUserId: undefined,
    })

    if (parsed.kind === 'opportunity') {
      const reflected = await this.uow.execute(async (ctx) => {
        const opportunity = await ctx.opportunities.findById(parsed.opportunityId)
        if (!opportunity) return false
        const added = opportunity.recordSyncedAttachment(attachment)
        if (!added) return true
        await ctx.opportunities.save(opportunity)
        return true
      })
      if (!reflected) {
        await this.attachmentStorage.deleteObject(cmd.filePath)
        return { reflected: false, reason: 'parent_not_found' }
      }
      return { reflected: true, reason: 'synced' }
    }

    const reflected = await this.uow.execute(async (ctx) => {
      const internship = await ctx.internships.findById(parsed.internshipId)
      if (!internship) return false
      const added = internship.recordSyncedAttachment(attachment, parsed.userId)
      if (!added) return internship.userId === parsed.userId
      await ctx.internships.save(internship)
      return true
    })
    if (!reflected) {
      await this.attachmentStorage.deleteObject(cmd.filePath)
      return { reflected: false, reason: 'prefix_owner_mismatch' }
    }
    return { reflected: true, reason: 'synced' }
  }
}

function attachmentIdForFilePath(filePath: string): string {
  const hash = createHash('sha256').update(filePath).digest('base64url').slice(0, 24)
  return `att_${hash}`
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}
