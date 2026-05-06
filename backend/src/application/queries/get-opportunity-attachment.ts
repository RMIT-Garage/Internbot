import type { RequestActor } from '../actor'
import type { AttachmentDownloadResult } from '../models/attachment'
import type { AttachmentStorage } from '../ports/attachment-storage'
import type { UnitOfWork, UnitOfWorkContext } from '../ports/unit-of-work'
import { ConflictError, ForbiddenError, NotFoundError } from '../../domain/errors'

export interface GetOpportunityAttachmentQuery {
  readonly actor: RequestActor
  readonly opportunityId: string
  readonly attachmentId: string
}

export interface AttachmentDownloadOptions {
  readonly ttlMs?: number
  readonly now?: () => Date
}

const DEFAULT_DOWNLOAD_TTL_MS = 10 * 60 * 1000

export class GetOpportunityAttachmentQueryHandler {
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

  async handle(q: GetOpportunityAttachmentQuery): Promise<AttachmentDownloadResult> {
    const platformUser = q.actor.platformUser
    if (!platformUser) {
      throw new ForbiddenError('Caller has no platform user record.', 'no_platform_user')
    }

    const attachment = await this.uow.execute(async (ctx) => {
      const opportunity = await ctx.opportunities.findById(q.opportunityId)
      if (!opportunity) throw new NotFoundError('Opportunity', q.opportunityId)

      if (platformUser.role === 'student') {
        const semesterId = await selectedSemesterId(ctx, platformUser.id)
        const canRead =
          (opportunity.status === 'published' && opportunity.semesterId === semesterId) ||
          opportunity.submittedByUserId === platformUser.id
        if (!canRead) {
          throw new ForbiddenError(
            'Opportunity is not visible to this student',
            'opportunity_not_visible'
          )
        }
      }

      const found = await ctx.opportunities.findAttachmentById(q.opportunityId, q.attachmentId)
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

async function selectedSemesterId(ctx: UnitOfWorkContext, userId: string): Promise<string> {
  const user = await ctx.users.findById(userId)
  const semesterId = user?.studentProfile?.semesterId
  if (!user || user.role !== 'student' || semesterId === undefined) {
    throw new ConflictError('Student has no selected semester', 'student_has_no_selected_semester')
  }
  return semesterId
}
