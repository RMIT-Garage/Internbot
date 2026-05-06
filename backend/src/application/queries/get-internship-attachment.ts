import type { RequestActor } from '../actor'
import type { AttachmentDownloadResult } from '../models/attachment'
import type { AttachmentStorage } from '../ports/attachment-storage'
import type { UnitOfWork } from '../ports/unit-of-work'
import { ForbiddenError, NotFoundError } from '../../domain/errors'

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
    private readonly uow: UnitOfWork,
    private readonly attachmentStorage: AttachmentStorage,
    options: AttachmentDownloadOptions = {}
  ) {
    this.ttlMs = options.ttlMs ?? DEFAULT_DOWNLOAD_TTL_MS
    this.now = options.now ?? (() => new Date())
  }

  async handle(q: GetInternshipAttachmentQuery): Promise<AttachmentDownloadResult> {
    const platformUser = q.actor.platformUser
    if (!platformUser) {
      throw new ForbiddenError('Caller has no platform user record.', 'no_platform_user')
    }

    const attachment = await this.uow.execute(async (ctx) => {
      const internship = await ctx.internships.findById(q.internshipId)
      if (!internship) throw new NotFoundError('Internship', q.internshipId)
      if (platformUser.role === 'student' && internship.userId !== platformUser.id) {
        throw new ForbiddenError(
          'Students may only read their own internships',
          'student_not_owner'
        )
      }

      const found = await ctx.internships.findAttachmentById(q.internshipId, q.attachmentId)
      if (!found) throw new NotFoundError('Attachment', q.attachmentId)
      return found
    })

    const downloadUrlExpiresAt = new Date(this.now().getTime() + this.ttlMs)
    const downloadUrl = await this.attachmentStorage.createReadUrl(
      attachment.filePath,
      downloadUrlExpiresAt
    )
    return { attachment, downloadUrl, downloadUrlExpiresAt }
  }
}
