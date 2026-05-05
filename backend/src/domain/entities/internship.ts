import type {
  InternshipCoordinatorDecision,
  InternshipStatus,
} from '../value-objects/internship-enums'
import type { Role } from '../value-objects/user-enums'
import { InternshipActivity } from '../value-objects/internship-activity'
import { ConflictError, ValidationError } from '../errors'

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

export class Internship {
  #props: InternshipProps
  #pendingActivity: InternshipActivity | undefined

  private constructor(props: InternshipProps, pendingActivity?: InternshipActivity) {
    this.#props = props
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

  static rehydrate(props: InternshipProps): Internship {
    return new Internship(props)
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
    this.#pendingActivity = InternshipActivity.submitOffer({
      id: activityId,
      authorUserId: this.#props.userId,
      authorRole: 'student',
      createdAt: now,
    })
  }

  comment(
    activityId: string,
    actorUserId: string,
    actorRole: Role,
    text: string,
    now: Date
  ): InternshipActivity {
    return InternshipActivity.comment({
      id: activityId,
      authorUserId: actorUserId,
      authorRole: actorRole,
      text,
      createdAt: now,
    })
  }

  #assertEditable(): void {
    if (this.#props.status === 'offer_approved' || this.#props.status === 'rejected') {
      throw new ConflictError('Internship is in a non-editable state', 'internship_not_editable')
    }
  }
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
