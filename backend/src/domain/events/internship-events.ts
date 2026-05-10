import type { DomainEvent } from './domain-event'
import type { Attachment } from '../value-objects/attachment'
import type { InternshipActivity } from '../value-objects/internship-activity'

/** Student applied to an opportunity — emitted from `Internship.createApplication`. */
export class InternshipApplied implements DomainEvent {
  readonly kind = 'internship_applied' as const
  readonly occurredAt: Date
  readonly activity: InternshipActivity

  constructor(activity: InternshipActivity) {
    this.activity = activity
    this.occurredAt = activity.createdAt
  }
}

/** Student edited offer details (offerDate / startDate / endDate) before submission. */
export class InternshipOfferEdited implements DomainEvent {
  readonly kind = 'internship_offer_edited' as const
  readonly occurredAt: Date
  readonly activity: InternshipActivity

  constructor(activity: InternshipActivity) {
    this.activity = activity
    this.occurredAt = activity.createdAt
  }
}

/** Student submitted the offer for coordinator review (`applied → offer_pending_review`). */
export class InternshipOfferSubmitted implements DomainEvent {
  readonly kind = 'internship_offer_submitted' as const
  readonly occurredAt: Date
  readonly activity: InternshipActivity

  constructor(activity: InternshipActivity) {
    this.activity = activity
    this.occurredAt = activity.createdAt
  }
}

/** Coordinator approved / requested-changes-on / rejected the offer. */
export class InternshipDecided implements DomainEvent {
  readonly kind = 'internship_decided' as const
  readonly occurredAt: Date
  readonly activity: InternshipActivity

  constructor(activity: InternshipActivity) {
    this.activity = activity
    this.occurredAt = activity.createdAt
  }
}

/**
 * A comment was posted on the timeline. Activity-only — does NOT rotate
 * `version` (matches the historical "comments don't break OCC" behavior).
 */
export class InternshipCommented implements DomainEvent {
  readonly kind = 'internship_commented' as const
  readonly occurredAt: Date
  readonly activity: InternshipActivity

  constructor(activity: InternshipActivity) {
    this.activity = activity
    this.occurredAt = activity.createdAt
  }
}

/**
 * Storage trigger reflected a finalized GCS object into Firestore. Subdoc-only
 * write — does NOT rotate `version`, since the trigger has no ETag context.
 */
export class InternshipAttachmentAdded implements DomainEvent {
  readonly kind = 'internship_attachment_added' as const
  readonly occurredAt: Date
  readonly attachment: Attachment

  constructor(attachment: Attachment) {
    this.attachment = attachment
    this.occurredAt = attachment.uploadedAt
  }
}

/**
 * Student hard-deleted one of their attachments. The subdoc is removed
 * inside the txn; the same txn also writes an `attachmentPurgeQueue` row a
 * worker drains to delete the GCS object. Rotates the parent ETag (the
 * visible attachment list changed).
 */
export class InternshipAttachmentRemoved implements DomainEvent {
  readonly kind = 'internship_attachment_removed' as const
  readonly occurredAt: Date
  readonly attachment: Attachment
  readonly removedByUserId: string

  constructor(attachment: Attachment, removedByUserId: string, removedAt: Date) {
    this.attachment = attachment
    this.removedByUserId = removedByUserId
    this.occurredAt = removedAt
  }
}

export type InternshipDomainEvent =
  | InternshipApplied
  | InternshipOfferEdited
  | InternshipOfferSubmitted
  | InternshipDecided
  | InternshipCommented
  | InternshipAttachmentAdded
  | InternshipAttachmentRemoved
