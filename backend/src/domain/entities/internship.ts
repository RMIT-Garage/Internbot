import type {
  InternshipCoordinatorDecision,
  InternshipStatus,
} from '../value-objects/internship-enums'
import type { Role } from '../value-objects/user-enums'
import { InternshipActivity } from '../value-objects/internship-activity'
import type { Attachment } from '../value-objects/attachment'
import { ConflictError, NotFoundError, ValidationError } from '../errors'
import type { InternshipDomainEvent } from '../events/internship-events'
import {
  InternshipApplied,
  InternshipAttachmentAdded,
  InternshipAttachmentFinalized,
  InternshipAttachmentRemoved,
  InternshipCommented,
  InternshipDecided,
  InternshipOfferEdited,
  InternshipOfferSubmitted,
} from '../events/internship-events'

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

export class Internship {
  #props: InternshipProps
  #attachments: Attachment[]
  /**
   * Transient domain events emitted by mutation methods. Drained by
   * `InternshipRepository.save` and translated to Firestore writes inside
   * one transaction. Whether the parent doc rotates `version` is derived
   * from the event kinds via {@link rotatesParent} — `applied`, `edited`,
   * `submitted`, `decided`, and `attachment_soft_deleted` rotate; `commented`
   * and `attachment_added` do not (matching the historical "comments don't
   * break OCC" + "storage trigger has no ETag context" semantics).
   */
  #pendingEvents: InternshipDomainEvent[] = []

  private constructor(props: InternshipProps, attachments: readonly Attachment[] = []) {
    this.#props = props
    this.#attachments = [...attachments]
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
    const activity = InternshipActivity.apply({
      id: props.activityId,
      authorUserId: props.userId,
      authorRole: 'student',
      createdAt: props.now,
    })
    internship.#pendingEvents.push(new InternshipApplied(activity))
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
  get pendingEvents(): readonly InternshipDomainEvent[] {
    return this.#pendingEvents
  }
  get attachments(): readonly Attachment[] {
    return this.#attachments
  }

  /**
   * True when any emitted event mutated parent-level state (offer fields,
   * status, decision, or attachment removal). Drives the repo's `save()`:
   * parent-mutation saves rotate `version` and write the full parent payload;
   * comment-only / attachment-add-only saves skip the parent update,
   * matching the historical "comments don't break OCC" behavior + storage
   * trigger semantics.
   */
  get hasParentMutation(): boolean {
    return this.#pendingEvents.some(eventRotatesParent)
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
    const activity = InternshipActivity.edit({
      id: activityId,
      authorUserId: this.#props.userId,
      authorRole: 'student',
      createdAt: now,
    })
    this.#pendingEvents.push(new InternshipOfferEdited(activity))
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
    const activity = InternshipActivity.submitOffer({
      id: activityId,
      authorUserId: this.#props.userId,
      authorRole: 'student',
      createdAt: now,
    })
    this.#pendingEvents.push(new InternshipOfferSubmitted(activity))
  }

  /**
   * Add a comment to this internship's activity timeline. Comments do not
   * mutate parent fields and do not rotate `version` — `save()` writes the
   * activity row only. Returns the created VO so callers can surface it in
   * their HTTP response without re-reading the event list.
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
    this.#pendingEvents.push(new InternshipCommented(activity))
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
    const activity = decisionActivity(details.decision, {
      id: activityId,
      authorUserId: reviewerUserId,
      text: comment,
      createdAt: now,
    })
    this.#pendingEvents.push(new InternshipDecided(activity))
  }

  /**
   * Hard-deletes an attachment owned by this internship. Allowed only while
   * the offer is still in the student's hands (`applied` or
   * `offer_changes_requested`). The repo removes the Firestore subdoc and,
   * inside the same txn, writes an `attachmentPurgeQueue` outbox row a
   * worker drains to delete the underlying GCS object.
   */
  removeAttachment(attachmentId: string, removedByUserId: string, now: Date): void {
    if (!INTERNSHIP_ATTACHMENT_DELETABLE_STATUSES.has(this.#props.status)) {
      throw new ConflictError(
        'Attachments are locked once the offer is under review or finalised',
        'attachment_locked_in_status'
      )
    }

    const index = this.#attachments.findIndex((a) => a.id === attachmentId)
    const existing = index >= 0 ? this.#attachments[index] : undefined
    if (!existing) {
      throw new NotFoundError('Attachment', attachmentId)
    }

    this.#attachments.splice(index, 1)
    this.#pendingEvents.push(new InternshipAttachmentRemoved(existing, removedByUserId, now))
  }

  /**
   * Pre-write an attachment subdoc in `uploading` state. Called by the
   * upload-intent handler before the client PUTs to GCS via the signed URL.
   * Validates that the caller-supplied owner matches this internship's
   * `userId` and that the attachment id isn't already used. Returns true
   * when newly added; false otherwise.
   */
  recordAttachmentUploadIntent(attachment: Attachment, expectedUserId: string): boolean {
    if (this.#props.userId !== expectedUserId) return false
    if (this.#attachments.some((a) => a.id === attachment.id)) return false
    this.#attachments.push(attachment)
    this.#pendingEvents.push(new InternshipAttachmentAdded(attachment))
    return true
  }

  /**
   * Transition an existing `uploading` attachment to `finalized` after the
   * Cloud Storage `OBJECT_FINALIZE` event confirms the upload landed. No-op
   * (returns false) if the attachment id is unknown or already finalized —
   * keeps the worker idempotent under event redelivery.
   */
  finalizeAttachment(
    attachmentId: string,
    storageGeneration: string | undefined,
    finalizedAt: Date
  ): boolean {
    const index = this.#attachments.findIndex((a) => a.id === attachmentId)
    if (index < 0) return false
    const existing = this.#attachments[index]!
    if (existing.isFinalized()) return false
    const finalized = existing.withFinalized(storageGeneration, finalizedAt)
    this.#attachments[index] = finalized
    this.#pendingEvents.push(new InternshipAttachmentFinalized(finalized, finalizedAt))
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

/**
 * Whether an emitted event rotates the parent doc's `version`. Comments
 * (activity-only) and storage-trigger attachment syncs (subdoc-only) do
 * not. Everything else does — keeps the historical "comments don't break
 * OCC" semantics while letting attachment soft-deletes invalidate cached
 * ETags.
 */
function eventRotatesParent(event: InternshipDomainEvent): boolean {
  switch (event.kind) {
    case 'internship_applied':
    case 'internship_offer_edited':
    case 'internship_offer_submitted':
    case 'internship_decided':
    case 'internship_attachment_removed':
      return true
    case 'internship_commented':
    case 'internship_attachment_added':
    case 'internship_attachment_finalized':
      return false
  }
}

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
