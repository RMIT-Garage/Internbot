import type { EmailDeliveryStatus, NotificationType } from '../value-objects/notification-enums'
import type { InternshipCoordinatorDecision } from '../value-objects/internship-enums'
import { ValidationError } from '../errors'

export interface NotificationProps {
  readonly id: string
  readonly version: number
  readonly userId: string
  readonly type: NotificationType
  readonly title: string
  readonly body: string
  readonly relatedInternshipId: string | undefined
  readonly relatedOpportunityId: string | undefined
  readonly relatedTicketId: string | undefined
  readonly emailDeliveryStatus: EmailDeliveryStatus | undefined
  readonly emailDeliveredAt: Date | undefined
  readonly readAt: Date | undefined
  readonly createdAt: Date
  readonly updatedAt: Date
}

/**
 * Notification — user-facing notification aggregate.
 *
 * Phase 4 only creates opportunity verification notifications. Phase 8 will
 * add read-state commands and list queries, but identity and state already
 * belong to this aggregate rather than to Opportunity persistence.
 */
export class Notification {
  #props: NotificationProps

  private constructor(props: NotificationProps) {
    this.#props = props
  }

  static create(props: NotificationProps): Notification {
    validateRequiredText('userId', props.userId)
    validateRequiredText('title', props.title)
    validateRequiredText('body', props.body)
    return new Notification(props)
  }

  static rehydrate(props: NotificationProps): Notification {
    return new Notification(props)
  }

  static forOpportunityVerification(props: {
    id: string
    userId: string
    opportunityId: string
    approved: boolean
    now: Date
  }): Notification {
    return Notification.create({
      id: props.id,
      version: 0,
      userId: props.userId,
      type: props.approved ? 'opportunity_verified' : 'opportunity_rejected',
      title: props.approved ? 'Opportunity verified' : 'Opportunity rejected',
      body: props.approved
        ? 'Your submitted opportunity has been approved.'
        : 'Your submitted opportunity was rejected.',
      relatedInternshipId: undefined,
      relatedOpportunityId: props.opportunityId,
      relatedTicketId: undefined,
      emailDeliveryStatus: undefined,
      emailDeliveredAt: undefined,
      readAt: undefined,
      createdAt: props.now,
      updatedAt: props.now,
    })
  }

  static forNewApplication(props: {
    id: string
    userId: string
    internshipId: string
    opportunityId: string
    now: Date
  }): Notification {
    return Notification.create({
      id: props.id,
      version: 0,
      userId: props.userId,
      type: 'new_application',
      title: 'New internship application',
      body: 'A student has applied to an opportunity.',
      relatedInternshipId: props.internshipId,
      relatedOpportunityId: props.opportunityId,
      relatedTicketId: undefined,
      emailDeliveryStatus: undefined,
      emailDeliveredAt: undefined,
      readAt: undefined,
      createdAt: props.now,
      updatedAt: props.now,
    })
  }

  static forOfferDecision(props: {
    id: string
    userId: string
    internshipId: string
    opportunityId: string
    decision: InternshipCoordinatorDecision
    now: Date
  }): Notification {
    return Notification.create({
      id: props.id,
      version: 0,
      userId: props.userId,
      type: 'offer_decision',
      title: offerDecisionTitle(props.decision),
      body: offerDecisionBody(props.decision),
      relatedInternshipId: props.internshipId,
      relatedOpportunityId: props.opportunityId,
      relatedTicketId: undefined,
      emailDeliveryStatus: undefined,
      emailDeliveredAt: undefined,
      readAt: undefined,
      createdAt: props.now,
      updatedAt: props.now,
    })
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
  get type(): NotificationType {
    return this.#props.type
  }
  get title(): string {
    return this.#props.title
  }
  get body(): string {
    return this.#props.body
  }
  get relatedInternshipId(): string | undefined {
    return this.#props.relatedInternshipId
  }
  get relatedOpportunityId(): string | undefined {
    return this.#props.relatedOpportunityId
  }
  get relatedTicketId(): string | undefined {
    return this.#props.relatedTicketId
  }
  get emailDeliveryStatus(): EmailDeliveryStatus | undefined {
    return this.#props.emailDeliveryStatus
  }
  get emailDeliveredAt(): Date | undefined {
    return this.#props.emailDeliveredAt
  }
  get readAt(): Date | undefined {
    return this.#props.readAt
  }
  get createdAt(): Date {
    return this.#props.createdAt
  }
  get updatedAt(): Date {
    return this.#props.updatedAt
  }

  markRead(now: Date): void {
    if (this.#props.readAt !== undefined) return
    this.#props = { ...this.#props, readAt: now }
  }
}

function offerDecisionTitle(decision: InternshipCoordinatorDecision): string {
  if (decision === 'approved') return 'Internship offer approved'
  if (decision === 'changes_requested') return 'Internship offer changes requested'
  return 'Internship offer rejected'
}

function offerDecisionBody(decision: InternshipCoordinatorDecision): string {
  if (decision === 'approved') return 'Your internship offer has been approved.'
  if (decision === 'changes_requested') return 'Changes were requested for your internship offer.'
  return 'Your internship offer was rejected.'
}

function validateRequiredText(field: string, value: string): void {
  if (value.trim().length === 0) {
    throw new ValidationError(`${field} is required`, 'invalid_notification', [
      { field, code: 'required', message: `${field} cannot be empty` },
    ])
  }
}

export const NOTIFICATION_SCHEMA_VERSION = 1 as const
