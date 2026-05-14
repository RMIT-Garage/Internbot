import type { RequestActor } from '../actor'
import type { OpportunityQueryService } from '../ports/queries/opportunity-query-service'
import type { UserQueryService } from '../ports/queries/user-query-service'
import type { AuthorizationService } from '../ports/authorization-service'
import type { AttachmentStorage } from '../ports/attachment-storage'
import { ConflictError, ForbiddenError, NotFoundError } from '../../domain/errors'

export type { AttachmentDownloadResult } from './get-internship-attachment'
import type { AttachmentDownloadResult } from './get-internship-attachment'

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
    private readonly opportunityQueries: OpportunityQueryService,
    private readonly userQueries: UserQueryService,
    private readonly authz: AuthorizationService,
    private readonly attachmentStorage: AttachmentStorage,
    options: AttachmentDownloadOptions = {}
  ) {
    this.ttlMs = options.ttlMs ?? DEFAULT_DOWNLOAD_TTL_MS
    this.now = options.now ?? (() => new Date())
  }

  async handle(q: GetOpportunityAttachmentQuery): Promise<AttachmentDownloadResult> {
    const platformUser = this.authz.requirePlatformUser(q.actor)

    const opportunity = await this.opportunityQueries.findById(q.opportunityId)
    if (!opportunity) throw new NotFoundError('Opportunity', q.opportunityId)

    if (platformUser.role === 'student') {
      const semesterId = await this.selectedSemesterId(platformUser.id)
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

    const attachment = await this.opportunityQueries.findAttachmentById(
      q.opportunityId,
      q.attachmentId
    )
    if (!attachment) throw new NotFoundError('Attachment', q.attachmentId)

    const downloadUrlExpiresAt = new Date(this.now().getTime() + this.ttlMs)
    const downloadUrl = await this.attachmentStorage.createReadUrl(
      attachment.filePath,
      downloadUrlExpiresAt
    )
    return { attachment, downloadUrl, downloadUrlExpiresAt }
  }

  private async selectedSemesterId(userId: string): Promise<string> {
    const user = await this.userQueries.findById(userId)
    const semesterId = user?.studentProfile?.semesterId
    if (!user || user.role !== 'student' || semesterId === undefined) {
      throw new ConflictError(
        'Student has no selected semester',
        'student_has_no_selected_semester'
      )
    }
    return semesterId
  }
}
