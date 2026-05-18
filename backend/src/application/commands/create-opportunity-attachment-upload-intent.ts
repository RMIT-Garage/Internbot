import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { AuthorizationService } from '../ports/authorization-service'
import type { IdGenerator } from '../ports/id-generator'
import type { AttachmentStorage } from '../ports/attachment-storage'
import { Attachment } from '../../domain/value-objects/attachment'
import { NotFoundError } from '../../domain/errors'

export interface CreateOpportunityAttachmentUploadIntentCommand {
  readonly actor: RequestActor
  readonly opportunityId: string
  readonly fileName: string
  readonly contentType: string
}

export interface CreateOpportunityAttachmentUploadIntentResult {
  readonly attachmentId: string
  readonly filePath: string
  readonly uploadUrl: string
  readonly uploadExpiresAt: Date
}

export interface CreateOpportunityAttachmentUploadIntentOptions {
  readonly ttlMs?: number
  readonly now?: () => Date
}

const DEFAULT_TTL_MS = 15 * 60 * 1000

/**
 * Coordinator-only counterpart to the internship intent handler. Issues a V4
 * signed PUT URL for an opportunity position-description attachment. The
 * signed URL is the upload's authorization — no Storage rules, no
 * cross-service Firestore reads. See the internship variant for the
 * one-step metadata-write rationale.
 */
export class CreateOpportunityAttachmentUploadIntentCommandHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly authz: AuthorizationService,
    private readonly idGenerator: IdGenerator,
    private readonly attachmentStorage: AttachmentStorage,
    private readonly options: CreateOpportunityAttachmentUploadIntentOptions = {}
  ) {}

  async handle(
    cmd: CreateOpportunityAttachmentUploadIntentCommand
  ): Promise<CreateOpportunityAttachmentUploadIntentResult> {
    this.authz.requireRole(cmd.actor, 'coordinator')

    const now = (this.options.now ?? (() => new Date()))()
    const ttlMs = this.options.ttlMs ?? DEFAULT_TTL_MS
    const expiresAt = new Date(now.getTime() + ttlMs)
    const attachmentId = `att_${this.idGenerator.next()}`
    const safeFileName = sanitizeFileName(cmd.fileName)
    const filePath = `opportunities/${cmd.opportunityId}/attachments/${attachmentId}-${safeFileName}`

    await this.uow.execute(async (ctx) => {
      const opportunity = await ctx.opportunities.findById(cmd.opportunityId)
      if (!opportunity) throw new NotFoundError('Opportunity', cmd.opportunityId)

      const attachment = Attachment.create({
        id: attachmentId,
        filePath,
        fileName: cmd.fileName,
        contentType: cmd.contentType,
        uploadedAt: now,
        storageGeneration: undefined,
        uploadStatus: 'uploading',
      })
      const added = opportunity.recordAttachmentUploadIntent(attachment)
      if (added) await ctx.opportunities.save(opportunity)
    })

    const uploadUrl = await this.attachmentStorage.createUploadUrl(
      filePath,
      cmd.contentType,
      expiresAt
    )

    return { attachmentId, filePath, uploadUrl, uploadExpiresAt: expiresAt }
  }
}

function sanitizeFileName(input: string): string {
  const trimmed = input.trim()
  const collapsed = trimmed.length > 0 ? trimmed : 'upload'
  return collapsed.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 200)
}
