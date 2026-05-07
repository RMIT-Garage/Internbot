import type {
  InternshipCoordinatorDecision,
  InternshipStatus,
} from '../value-objects/internship-enums'
import type { Role } from '../value-objects/user-enums'
import { InternshipActivity } from '../value-objects/internship-activity'
import type { Attachment } from '../value-objects/attachment'
import { ConflictError, NotFoundError, ValidationError } from '../errors'

export interface InternshipProps {
  readonly id: string
  readonly version: number
  readonly userId: string
  readonly opportunityId: string
  readonly offerDate: Date | undefined
  readonly startDate: Date | undefined
  readonly endDate: Date | undefined
  readonly status: InternshipStatus
  readonly coordinatorDecision: InternshipCoordinatorDecision | undefined
  readonly coordinatorComment: string | undefined
  readonly reviewedByUserId: string | undefined
  readonly reviewedAt: Date | undefined
  readonly lastSubmittedAt: Date | undefined
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface InternshipOfferDetails {
  readonly offerDate: Date | undefined
  readonly startDate: Date | undefined
  readonly endDate: Date | undefined
}

export interface InternshipOfferSubmissionDetails {
  readonly offerDate: Date
  readonly startDate: Date
  readonly endDate: Date | undefined
}

export interface InternshipDecisionDetails {
  readonly decision: InternshipCoordinatorDecision
  readonly comment: string | undefined
}

export interface PendingAttachmentSoftDelete {
  readonly attachmentId: string
  readonly deletedAt: Date
  readonly deletedByUserId: string
}

export class Internship {
  #props: InternshipProps
  #pendingActivity: InternshipActivity | undefined
  #attachments: Attachment[]
  #pendingAttachmentSoftDeletes: PendingAttachmentSoftDelete[] = []
  #pendingAttachmentAdds: Attachment[] = []
  /**
   * True when a domain command mutated parent-level state (offer fields,
   * status, decision, or attachment tombstones). Drives the repo's `save()`:
   * parent-mutation saves rotate `version` and write the full parent payload;
   * comment-only saves append the activity row without rotating the ETag,
   * matching the historical "comments don't break OCC" behavior.
   */
  #hasParentMutation = false

  private constructor(
    props: InternshipProps,
    attachments: readonly Attachment[] = [],
    pendingActivity?: InternshipActivity
  ) {
    this.#props = props
    this.#attachments = [...attachments]
    this.#pendingActivity = pendingActivity
  }

  static createApplication(props: {
    id: string
    userId: string
    opportunityId: string
    activityId: string
    now: Date
  }): Internship {
    const internship = Internship.create({
      id: props.id,
      version: 0,
      userId: props.userId,
      opportunityId: props.opportunityId,
      offerDate: undefined,
      startDate: undefined,
      endDate: undefined,
      status: 'applied',
      coordinatorDecision: undefined,
      coordinatorComment: undefined,
      reviewedByUserId: undefined,
      reviewedAt: undefined,
      lastSubmittedAt: undefined,
      createdAt: props.now,
      updatedAt: props.now,
    })
    internship.#pendingActivity = InternshipActivity.apply({
      id: props.activityId,
      authorUserId: props.userId,
      authorRole: 'student',
      createdAt: props.now,
    })
    return internship
  }

  static create(props: InternshipProps): Internship {
    validateRequiredText('userId', props.userId)
    validateRequiredText('opportunityId', props.opportunityId)
    validateOfferDates(props)
    return new Internship(props)
  }

  static rehydrate(props: InternshipProps, attachments: readonly Attachment[] = []): Internship {
    return new Internship(props, attachments)
  }

  get id(): string {
    return this.#props.id
  }
  get version(): number {
    return this.#props.version
  }
  get userId(): string {
    return this.#props.userId
  }
  get opportunityId(): string {
    return this.#props.opportunityId
  }
  get offerDate(): Date | undefined {
    return this.#props.offerDate
  }
  get startDate(): Date | undefined {
    return this.#props.startDate
  }
  get endDate(): Date | undefined {
    return this.#props.endDate
  }
  get status(): InternshipStatus {
    return this.#props.status
  }
  get coordinatorDecision(): InternshipCoordinatorDecision | undefined {
    return this.#props.coordinatorDecision
  }
  get coordinatorComment(): string | undefined {
    return this.#props.coordinatorComment
  }
  get reviewedByUserId(): string | undefined {
    return this.#props.reviewedByUserId
  }
  get reviewedAt(): Date | undefined {
    return this.#props.reviewedAt
  }
  get lastSubmittedAt(): Date | undefined {
    return this.#props.lastSubmittedAt
  }
  get createdAt(): Date {
    return this.#props.createdAt
  }
  get updatedAt(): Date {
    return this.#props.updatedAt
  }
  get pendingActivity(): InternshipActivity | undefined {
    return this.#pendingActivity
  }
  get attachments(): readonly Attachment[] {
    return this.#attachments
  }
  /**
   * Visible attachments — what list/get attachment queries should return.
   * Excludes soft-deleted entries.
   */
  get activeAttachments(): readonly Attachment[] {
    return this.#attachments.filter((a) => !a.isDeleted)
  }
  get pendingAttachmentSoftDeletes(): readonly PendingAttachmentSoftDelete[] {
    return this.#pendingAttachmentSoftDeletes
  }
  get pendingAttachmentAdds(): readonly Attachment[] {
    return this.#pendingAttachmentAdds
  }
  hasActiveAttachments(): boolean {
    return this.#attachments.some((a) => !a.isDeleted)
  }

  get hasParentMutation(): boolean {
    return this.#hasParentMutation
  }

  updateOfferDetails(details: InternshipOfferDetails, activityId: string, now: Date): void {
    this.#assertEditable()
    const next = {
      ...this.#props,
      offerDate: details.offerDate ?? this.#props.offerDate,
      startDate: details.startDate ?? this.#props.startDate,
      endDate: details.endDate,
    }
    validateOfferDates(next)
    this.#props = next
    this.#hasParentMutation = true
    this.#pendingActivity = InternshipActivity.edit({
      id: activityId,
      authorUserId: this.#props.userId,
      authorRole: 'student',
      createdAt: now,
    })
  }

  submitOffer(
    details: InternshipOfferSubmissionDetails,
    activityId: string,
    now: Date,
    hasOfferAttachment: boolean
  ): void {
    if (!hasOfferAttachment) {
      throw new ValidationError(
        'At least one offer attachment is required',
        'offer_attachment_missing',
        [
          {
            field: 'attachments',
            code: 'required',
            message: 'at least one offer attachment is required before offer submission',
          },
        ]
      )
    }
    if (this.#props.status !== 'applied' && this.#props.status !== 'offer_changes_requested') {
      throw new ConflictError(
        'Internship is not ready for offer submission',
        'invalid_state_transition'
      )
    }

    const next = {
      ...this.#props,
      offerDate: details.offerDate,
      startDate: details.startDate,
      endDate: details.endDate,
      status: 'offer_pending_review' as const,
      lastSubmittedAt: now,
    }
    validateOfferDates(next)
    this.#props = next
    this.#hasParentMutation = true
    this.#pendingActivity = InternshipActivity.submitOffer({
      id: activityId,
      authorUserId: this.#props.userId,
      authorRole: 'student',
      createdAt: now,
    })
  }

  /**
   * Stage a comment on this internship's activity timeline. Comments do not
   * mutate parent fields and do not rotate `version` — `save()` writes the
   * activity row only. Returns the staged VO so callers can surface it in
   * their HTTP response without re-reading `pendingActivity`.
   */
  comment(
    activityId: string,
    actorUserId: string,
    actorRole: Role,
    text: string,
    now: Date
  ): InternshipActivity {
    const activity = InternshipActivity.comment({
      id: activityId,
      authorUserId: actorUserId,
      authorRole: actorRole,
      text,
      createdAt: now,
    })
    this.#pendingActivity = activity
    return activity
  }

  decideOffer(
    details: InternshipDecisionDetails,
    activityId: string,
    reviewerUserId: string,
    now: Date
  ): void {
    if (this.#props.status !== 'offer_pending_review') {
      throw new ConflictError('Internship is not pending offer review', 'invalid_state_transition')
    }

    const comment = details.comment?.trim()
    if (
      (details.decision === 'changes_requested' || details.decision === 'rejected') &&
      (comment === undefined || comment.length === 0)
    ) {
      throw new ValidationError(
        'comment is required for this decision',
        'comment_required_for_decision',
        [
          {
            field: 'comment',
            code: 'required',
            message: 'comment is required when decision is changes_requested or rejected',
          },
        ]
      )
    }

    const status: InternshipStatus =
      details.decision === 'approved'
        ? 'offer_approved'
        : details.decision === 'changes_requested'
          ? 'offer_changes_requested'
          : 'rejected'

    this.#props = {
      ...this.#props,
      status,
      coordinatorDecision: details.decision,
      coordinatorComment: comment,
      reviewedByUserId: reviewerUserId,
      reviewedAt: now,
    }
    this.#hasParentMutation = true
    this.#pendingActivity = decisionActivity(details.decision, {
      id: activityId,
      authorUserId: reviewerUserId,
      text: comment,
      createdAt: now,
    })
  }

  /**
   * Soft-deletes an attachment owned by this internship. Allowed only while
   * the offer is still in the student's hands (`applied` or
   * `offer_changes_requested`). The Firestore row remains; a future outbox
   * worker hard-deletes the GCS object using the captured `storageGeneration`.
   */
  softDeleteAttachment(attachmentId: string, deletedByUserId: string, now: Date): void {
    if (!INTERNSHIP_ATTACHMENT_DELETABLE_STATUSES.has(this.#props.status)) {
      throw new ConflictError(
        'Attachments are locked once the offer is under review or finalised',
        'attachment_locked_in_status'
      )
    }

    const index = this.#attachments.findIndex((a) => a.id === attachmentId)
    const existing = index >= 0 ? this.#attachments[index] : undefined
    if (!existing || existing.isDeleted) {
      throw new NotFoundError('Attachment', attachmentId)
    }

    this.#attachments[index] = existing.markDeleted(deletedByUserId, now)
    this.#pendingAttachmentSoftDeletes.push({
      attachmentId,
      deletedAt: now,
      deletedByUserId,
    })
    this.#hasParentMutation = true
  }

  /**
   * Adopt an attachment finalized by the storage trigger. Validates that the
   * trigger's path-derived owner matches this internship's `userId` and that
   * we haven't already absorbed an attachment with the same id (idempotent).
   * Returns true if the attachment was newly added; false otherwise. Stages
   * the addition so the repo's `save()` writes the subdoc atomically.
   */
  recordSyncedAttachment(attachment: Attachment, expectedUserId: string): boolean {
    if (this.#props.userId !== expectedUserId) return false
    if (this.#attachments.some((a) => a.id === attachment.id)) return false
    this.#attachments.push(attachment)
    this.#pendingAttachmentAdds.push(attachment)
    return true
  }

  #assertEditable(): void {
    if (this.#props.status === 'offer_approved' || this.#props.status === 'rejected') {
      throw new ConflictError('Internship is in a non-editable state', 'internship_not_editable')
    }
  }
}

const INTERNSHIP_ATTACHMENT_DELETABLE_STATUSES: ReadonlySet<InternshipStatus> = new Set([
  'applied',
  'offer_changes_requested',
])

function decisionActivity(
  decision: InternshipCoordinatorDecision,
  props: {
    id: string
    authorUserId: string
    text: string | undefined
    createdAt: Date
  }
): InternshipActivity {
  if (decision === 'approved') {
    return InternshipActivity.approveOffer({ ...props, authorRole: 'coordinator' })
  }
  const text = props.text
  if (text === undefined) {
    throw new Error('Decision feedback text missing after validation')
  }
  if (decision === 'changes_requested') {
    return InternshipActivity.requestChanges({
      id: props.id,
      authorUserId: props.authorUserId,
      authorRole: 'coordinator',
      text,
      createdAt: props.createdAt,
    })
  }
  return InternshipActivity.reject({
    id: props.id,
    authorUserId: props.authorUserId,
    authorRole: 'coordinator',
    text,
    createdAt: props.createdAt,
  })
}

function validateRequiredText(field: string, value: string): void {
  if (value.trim().length === 0) {
    throw new ValidationError(`${field} is required`, 'invalid_internship', [
      { field, code: 'required', message: `${field} cannot be empty` },
    ])
  }
}

function validateOfferDates(
  props: Pick<InternshipProps, 'offerDate' | 'startDate' | 'endDate'>
): void {
  if (
    props.endDate !== undefined &&
    props.startDate !== undefined &&
    props.endDate < props.startDate
  ) {
    throw new ValidationError('endDate must not be before startDate', 'invalid_internship_dates', [
      { field: 'endDate', code: 'invalid', message: 'endDate must not be before startDate' },
    ])
  }
}

export const INTERNSHIP_SCHEMA_VERSION = 1 as const
