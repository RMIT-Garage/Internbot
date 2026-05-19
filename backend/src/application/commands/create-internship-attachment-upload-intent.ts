import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { AuthorizationService } from '../ports/authorization-service'
import type { IdGenerator } from '../ports/id-generator'
import type { AttachmentStorage } from '../ports/attachment-storage'
import { Attachment } from '../../domain/value-objects/attachment'
import { NotFoundError } from '../../domain/errors'

export interface CreateInternshipAttachmentUploadIntentCommand {
  readonly actor: RequestActor
  readonly internshipId: string
  readonly fileName: string
  readonly contentType: string
}

export interface CreateInternshipAttachmentUploadIntentResult {
  readonly attachmentId: string
  readonly filePath: string
  readonly uploadUrl: string
  readonly uploadExpiresAt: Date
}

export interface CreateInternshipAttachmentUploadIntentOptions {
  /** Upload URL TTL. Defaults to 15 minutes — long enough for slow clients. */
  readonly ttlMs?: number
  /** Now function — overridable in tests. */
  readonly now?: () => Date
}

const DEFAULT_TTL_MS = 15 * 60 * 1000

/**
 * Issues a V4 signed PUT URL the student-owner can upload an offer-letter
 * attachment to directly. Authorization happens here in the backend — the
 * signed URL itself is the only thing the client needs to upload, with no
 * Firebase Auth, no Storage rules, and no `userIdentities` cross-service
 * lookup required.
 *
 * Metadata is written to Firestore immediately (one-step intent design): if
 * the client's PUT to GCS later fails, the metadata is left dangling; the
 * next intent overwrites it. Offer submission still requires at least one
 * attachment row in Firestore (read-side enforcement), so a stale row that
 * doesn't correspond to a real GCS object will surface at signed-URL fetch
 * time as a 404 rather than at submission time.
 */
export class CreateInternshipAttachmentUploadIntentCommandHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly authz: AuthorizationService,
    private readonly idGenerator: IdGenerator,
    private readonly attachmentStorage: AttachmentStorage,
    private readonly options: CreateInternshipAttachmentUploadIntentOptions = {}
  ) {}

  async handle(
    cmd: CreateInternshipAttachmentUploadIntentCommand
  ): Promise<CreateInternshipAttachmentUploadIntentResult> {
    this.authz.requireRole(cmd.actor, 'student')

    const now = (this.options.now ?? (() => new Date()))()
    const ttlMs = this.options.ttlMs ?? DEFAULT_TTL_MS
    const expiresAt = new Date(now.getTime() + ttlMs)
    const attachmentId = `att_${this.idGenerator.next()}`
    const safeFileName = sanitizeFileName(cmd.fileName)

    let filePath = ''
    await this.uow.execute(async (ctx) => {
      const internship = await ctx.internships.findById(cmd.internshipId)
      if (!internship) throw new NotFoundError('Internship', cmd.internshipId)
      this.authz.requireSelfOrRole(cmd.actor, internship.userId, [], 'student_not_owner')

      filePath = `users/${internship.userId}/internships/${internship.id}/attachments/${attachmentId}-${safeFileName}`

      const attachment = Attachment.create({
        id: attachmentId,
        filePath,
        fileName: cmd.fileName,
        contentType: cmd.contentType,
        uploadedAt: now,
        storageGeneration: undefined,
        uploadStatus: 'uploading',
      })
      const added = internship.recordAttachmentUploadIntent(attachment, internship.userId)
      if (added) await ctx.internships.save(internship)
    })

    const uploadUrl = await this.attachmentStorage.createUploadUrl(
      filePath,
      cmd.contentType,
      expiresAt
    )

    return { attachmentId, filePath, uploadUrl, uploadExpiresAt: expiresAt }
  }
}

/**
 * Strip filename characters that don't belong in a Cloud Storage object name.
 * The `attachmentId-` prefix already guarantees uniqueness across uploads, so
 * sanitization here is purely about keeping the path readable + URL-safe.
 */
function sanitizeFileName(input: string): string {
  const trimmed = input.trim()
  const collapsed = trimmed.length > 0 ? trimmed : 'upload'
  // Replace anything outside a conservative allowlist with `-`.
  return collapsed.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 200)
}
