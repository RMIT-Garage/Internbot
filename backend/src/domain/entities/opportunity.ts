import type {
  OpportunityStatus,
  OpportunityTransitionTarget,
  OpportunityType,
  OpportunityVerificationDecision,
  WorkMode,
} from '../value-objects/opportunity-enums'
import { OpportunityTransition } from '../value-objects/opportunity-transition'
import { OpportunityVerification } from '../value-objects/opportunity-verification'
import { isCareerHubUrlAllowed } from '../services/career-hub-url-allowlist'
import { ConflictError, ValidationError } from '../errors'

export interface OpportunityProps {
  readonly id: string
  readonly version: number
  readonly semesterId: string
  readonly type: OpportunityType
  readonly employerName: string
  readonly jobTitle: string
  readonly descriptionText: string
  readonly workMode: WorkMode | undefined
  readonly location: string | undefined
  readonly sourceUrl: string | undefined
  readonly status: OpportunityStatus
  readonly createdByUserId: string | undefined
  readonly submittedByUserId: string | undefined
  readonly verifiedByUserId: string | undefined
  readonly verifiedAt: Date | undefined
  readonly createdAt: Date
  readonly updatedAt: Date
}

/**
 * Opportunity — root aggregate for semester-scoped positions.
 *
 * Mutable aggregate: PATCH-style edits mutate fields directly, lifecycle
 * methods stage transient audit records that the repository drains into the
 * `activity` subcollection atomically with the parent update.
 */
export class Opportunity {
  #props: OpportunityProps
  #pendingTransition: OpportunityTransition | undefined
  #pendingVerification: OpportunityVerification | undefined

  private constructor(props: OpportunityProps) {
    this.#props = props
  }

  static create(props: OpportunityProps): Opportunity {
    validateRequiredText('semesterId', props.semesterId)
    validateRequiredText('employerName', props.employerName)
    validateRequiredText('jobTitle', props.jobTitle)
    validateRequiredText('descriptionText', props.descriptionText)
    validateSourceUrl(props.type, props.sourceUrl)
    return new Opportunity(props)
  }

  static rehydrate(props: OpportunityProps): Opportunity {
    return new Opportunity(props)
  }

  get id(): string {
    return this.#props.id
  }
  get version(): number {
    return this.#props.version
  }
  get semesterId(): string {
    return this.#props.semesterId
  }
  get type(): OpportunityType {
    return this.#props.type
  }
  get employerName(): string {
    return this.#props.employerName
  }
  get jobTitle(): string {
    return this.#props.jobTitle
  }
  get descriptionText(): string {
    return this.#props.descriptionText
  }
  get workMode(): WorkMode | undefined {
    return this.#props.workMode
  }
  get location(): string | undefined {
    return this.#props.location
  }
  get sourceUrl(): string | undefined {
    return this.#props.sourceUrl
  }
  get status(): OpportunityStatus {
    return this.#props.status
  }
  get createdByUserId(): string | undefined {
    return this.#props.createdByUserId
  }
  get submittedByUserId(): string | undefined {
    return this.#props.submittedByUserId
  }
  get verifiedByUserId(): string | undefined {
    return this.#props.verifiedByUserId
  }
  get verifiedAt(): Date | undefined {
    return this.#props.verifiedAt
  }
  get createdAt(): Date {
    return this.#props.createdAt
  }
  get updatedAt(): Date {
    return this.#props.updatedAt
  }
  get pendingTransition(): OpportunityTransition | undefined {
    return this.#pendingTransition
  }
  get pendingVerification(): OpportunityVerification | undefined {
    return this.#pendingVerification
  }

  changeEmployerName(employerName: string): void {
    if (this.#props.employerName === employerName) return
    validateRequiredText('employerName', employerName)
    this.#props = { ...this.#props, employerName }
  }

  changeJobTitle(jobTitle: string): void {
    if (this.#props.jobTitle === jobTitle) return
    validateRequiredText('jobTitle', jobTitle)
    this.#props = { ...this.#props, jobTitle }
  }

  changeDescriptionText(descriptionText: string): void {
    if (this.#props.descriptionText === descriptionText) return
    validateRequiredText('descriptionText', descriptionText)
    this.#props = { ...this.#props, descriptionText }
  }

  changeWorkMode(workMode: WorkMode | undefined): void {
    if (this.#props.workMode === workMode) return
    this.#props = { ...this.#props, workMode }
  }

  changeLocation(location: string | undefined): void {
    if (this.#props.location === location) return
    this.#props = { ...this.#props, location }
  }

  changeSourceUrl(sourceUrl: string | undefined): void {
    if (this.#props.sourceUrl === sourceUrl) return
    validateSourceUrl(this.#props.type, sourceUrl)
    this.#props = { ...this.#props, sourceUrl }
  }

  applyTransition(
    target: OpportunityTransitionTarget,
    actorUserId: string,
    comment: string | undefined,
    now: Date
  ): void {
    if (!isAllowedTransition(this.#props.status, target)) {
      throw new ConflictError(
        `Cannot transition opportunity from '${this.#props.status}' to '${target}'`,
        'invalid_state_transition'
      )
    }

    const from = this.#props.status
    this.#props = { ...this.#props, status: target }
    this.#pendingTransition = OpportunityTransition.create({
      from,
      to: target,
      actorUserId,
      comment,
      createdAt: now,
    })
  }

  verify(
    decision: OpportunityVerificationDecision,
    actorUserId: string,
    comment: string | undefined,
    now: Date
  ): void {
    if (this.#props.status !== 'pending_verification') {
      throw new ConflictError('Opportunity is not pending verification', 'invalid_state_transition')
    }
    if (decision === 'rejected' && (comment === undefined || comment.trim().length === 0)) {
      throw new ValidationError(
        'comment is required for rejected verifications',
        'comment_required_for_decision',
        [
          {
            field: 'comment',
            code: 'required',
            message: 'comment is required when decision is rejected',
          },
        ]
      )
    }

    const from = this.#props.status
    const to: OpportunityStatus = decision === 'approved' ? 'published' : 'rejected'
    this.#props = {
      ...this.#props,
      status: to,
      verifiedByUserId: actorUserId,
      verifiedAt: now,
    }
    this.#pendingVerification = OpportunityVerification.create({
      from,
      to,
      decision,
      actorUserId,
      comment,
      createdAt: now,
    })
  }
}

function validateRequiredText(field: string, value: string): void {
  if (value.trim().length === 0) {
    throw new ValidationError(`${field} is required`, 'invalid_opportunity', [
      { field, code: 'required', message: `${field} cannot be empty` },
    ])
  }
}

function validateSourceUrl(type: OpportunityType, sourceUrl: string | undefined): void {
  if (type !== 'pre_approved') return
  if (sourceUrl === undefined || !isCareerHubUrlAllowed(sourceUrl)) {
    throw new ValidationError(
      'pre_approved opportunities require an RMIT Career Hub URL',
      'url_not_on_allowlist',
      [
        {
          field: 'sourceUrl',
          code: 'allowlist',
          message: 'sourceUrl must be an https://careerhub.rmit.edu.au URL',
        },
      ]
    )
  }
}

function isAllowedTransition(from: OpportunityStatus, to: OpportunityTransitionTarget): boolean {
  if (from === 'draft' && (to === 'published' || to === 'archived')) return true
  if (from === 'published' && to === 'archived') return true
  return false
}

export const OPPORTUNITY_SCHEMA_VERSION = 1 as const
