import type { RequestActor } from '../actor'
import type { InternshipQueryService } from '../ports/queries/internship-query-service'
import type { AuthorizationService } from '../ports/authorization-service'
import type { Attachment } from '../../domain/value-objects/attachment'
import type { AttachmentStorage } from '../ports/attachment-storage'
import { NotFoundError } from '../../domain/errors'

export interface AttachmentDownloadResult {
  readonly attachment: Attachment
  readonly downloadUrl: string
  readonly downloadUrlExpiresAt: Date
}

export interface GetInternshipAttachmentQuery {
  readonly actor: RequestActor
  readonly internshipId: string
  readonly attachmentId: string
}

export interface AttachmentDownloadOptions {
  readonly ttlMs?: number
  readonly now?: () => Date
}

const DEFAULT_DOWNLOAD_TTL_MS = 10 * 60 * 1000

export class GetInternshipAttachmentQueryHandler {
  private readonly ttlMs: number
  private readonly now: () => Date

  constructor(
    private readonly internshipQueries: InternshipQueryService,
    private readonly authz: AuthorizationService,
    private readonly attachmentStorage: AttachmentStorage,
    options: AttachmentDownloadOptions = {}
  ) {
    this.ttlMs = options.ttlMs ?? DEFAULT_DOWNLOAD_TTL_MS
    this.now = options.now ?? (() => new Date())
  }

  async handle(q: GetInternshipAttachmentQuery): Promise<AttachmentDownloadResult> {
    const internship = await this.internshipQueries.findById(q.internshipId)
    if (!internship) throw new NotFoundError('Internship', q.internshipId)

    this.authz.requireSelfOrRole(q.actor, internship.userId, 'coordinator', 'student_not_owner')

    const attachment = await this.internshipQueries.findAttachmentById(
      q.internshipId,
      q.attachmentId
    )
    if (!attachment) throw new NotFoundError('Attachment', q.attachmentId)
    if (!attachment.isFinalized()) throw new NotFoundError('Attachment', q.attachmentId)

    const downloadUrlExpiresAt = new Date(this.now().getTime() + this.ttlMs)
    const downloadUrl = await this.attachmentStorage.createReadUrl(
      attachment.filePath,
      downloadUrlExpiresAt
    )
    return { attachment, downloadUrl, downloadUrlExpiresAt }
  }
}
