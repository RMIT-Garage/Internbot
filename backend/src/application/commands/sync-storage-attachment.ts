import { createHash } from 'node:crypto'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { AttachmentStorage } from '../ports/attachment-storage'
import { Attachment } from '../../domain/value-objects/attachment'
import { parseAttachmentStoragePath } from '../../domain/value-objects/attachment-storage-path'

export interface SyncStorageAttachmentCommand {
  readonly filePath: string
  readonly contentType: string | undefined
  readonly finalizedAt: Date | undefined
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
    })

    if (parsed.kind === 'opportunity') {
      const reflected = await this.uow.execute((ctx) =>
        ctx.opportunities.saveAttachmentFromStorage(parsed.opportunityId, attachment)
      )
      if (!reflected) {
        await this.attachmentStorage.deleteObject(cmd.filePath)
        return { reflected: false, reason: 'parent_not_found' }
      }
      return { reflected: true, reason: 'synced' }
    }

    const outcome = await this.uow.execute((ctx) =>
      ctx.internships.replaceAttachmentsFromStorage(parsed.internshipId, parsed.userId, attachment)
    )
    if (!outcome.reflected) {
      await this.attachmentStorage.deleteObject(cmd.filePath)
      return { reflected: false, reason: 'prefix_owner_mismatch' }
    }

    await Promise.all(
      [...new Set(outcome.deletedFilePaths)].map((filePath) =>
        this.attachmentStorage.deleteObject(filePath)
      )
    )
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
