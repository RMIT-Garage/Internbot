import type { DomainEvent } from './domain-event'
import type { Attachment } from '../value-objects/attachment'
import type { OpportunityTransition } from '../value-objects/opportunity-transition'
import type { OpportunityVerification } from '../value-objects/opportunity-verification'

/** Opportunity transitioned (`draft → published`, `published → archived`, etc.). */
export class OpportunityTransitioned implements DomainEvent {
  readonly kind = 'opportunity_transitioned' as const
  readonly occurredAt: Date
  readonly transition: OpportunityTransition

  constructor(transition: OpportunityTransition) {
    this.transition = transition
    this.occurredAt = transition.createdAt
  }
}

/**
 * Coordinator verified a student-submitted opportunity (`pending_verification
 * → published` or `pending_verification → rejected`). Drives a status update
 * + verifiedBy/verifiedAt fields + activity row.
 */
export class OpportunityVerified implements DomainEvent {
  readonly kind = 'opportunity_verified' as const
  readonly occurredAt: Date
  readonly verification: OpportunityVerification

  constructor(verification: OpportunityVerification) {
    this.verification = verification
    this.occurredAt = verification.createdAt
  }
}

/** Storage trigger reflected a finalized GCS object into Firestore. */
export class OpportunityAttachmentAdded implements DomainEvent {
  readonly kind = 'opportunity_attachment_added' as const
  readonly occurredAt: Date
  readonly attachment: Attachment

  constructor(attachment: Attachment) {
    this.attachment = attachment
    this.occurredAt = attachment.uploadedAt
  }
}

/**
 * Coordinator hard-deleted an opportunity attachment. The subdoc is removed
 * inside the txn; the same txn also writes an `attachmentPurgeQueue` row a
 * worker drains to delete the GCS object.
 */
export class OpportunityAttachmentRemoved implements DomainEvent {
  readonly kind = 'opportunity_attachment_removed' as const
  readonly occurredAt: Date
  readonly attachment: Attachment
  readonly removedByUserId: string

  constructor(attachment: Attachment, removedByUserId: string, removedAt: Date) {
    this.attachment = attachment
    this.removedByUserId = removedByUserId
    this.occurredAt = removedAt
  }
}

export type OpportunityDomainEvent =
  | OpportunityTransitioned
  | OpportunityVerified
  | OpportunityAttachmentAdded
  | OpportunityAttachmentRemoved
