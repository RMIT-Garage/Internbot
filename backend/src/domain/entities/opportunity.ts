import type {
  OpportunityStatus,
  OpportunityTransitionTarget,
  OpportunityType,
  OpportunityVerificationDecision,
  WorkMode,
} from '../value-objects/opportunity-enums'
import type { Attachment } from '../value-objects/attachment'
import { OpportunityTransition } from '../value-objects/opportunity-transition'
import { OpportunityVerification } from '../value-objects/opportunity-verification'
import { ConflictError, NotFoundError, ValidationError } from '../errors'
import type { OpportunityDomainEvent } from '../events/opportunity-events'
import {
  OpportunityAttachmentAdded,
  OpportunityAttachmentRemoved,
  OpportunityTransitioned,
  OpportunityVerified,
} from '../events/opportunity-events'

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
  #attachments: Attachment[]
  /**
   * Transient domain events emitted by mutation methods. Drained by
   * `OpportunityRepository.save` and translated to Firestore writes inside
   * one transaction. Empty for rehydrated aggregates that haven't been
   * mutated yet.
   */
  #pendingEvents: OpportunityDomainEvent[] = []

  private constructor(props: OpportunityProps, attachments: readonly Attachment[] = []) {
    this.#props = props
    this.#attachments = [...attachments]
  }

  static create(props: OpportunityProps): Opportunity {
    validateRequiredText('semesterId', props.semesterId)
    validateRequiredText('employerName', props.employerName)
    validateRequiredText('jobTitle', props.jobTitle)
    validateRequiredText('descriptionText', props.descriptionText)
    validateSourceUrl(props.type, props.sourceUrl)
    return new Opportunity(props)
  }

  static rehydrate(props: OpportunityProps, attachments: readonly Attachment[] = []): Opportunity {
    return new Opportunity(props, attachments)
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
  get pendingEvents(): readonly OpportunityDomainEvent[] {
    return this.#pendingEvents
  }
  get attachments(): readonly Attachment[] {
    return this.#attachments
  }

  /**
   * Hard-deletes an opportunity attachment. Coordinator-only — the handler
   * enforces role; the aggregate enforces existence. The repo removes the
   * Firestore subdoc and writes an `attachmentPurgeQueue` outbox row inside
   * the same txn for the worker to GC the GCS object.
   */
  removeAttachment(attachmentId: string, removedByUserId: string, now: Date): void {
    const index = this.#attachments.findIndex((a) => a.id === attachmentId)
    const existing = index >= 0 ? this.#attachments[index] : undefined
    if (!existing) {
      throw new NotFoundError('Attachment', attachmentId)
    }

    this.#attachments.splice(index, 1)
    this.#pendingEvents.push(new OpportunityAttachmentRemoved(existing, removedByUserId, now))
  }

  /**
   * Adopt an attachment finalized by the storage trigger. Idempotent — adding
   * an attachment id we've already absorbed is a no-op. Stages the addition
   * for the repo's `save()` to write the subdoc atomically.
   */
  recordSyncedAttachment(attachment: Attachment): boolean {
    if (this.#attachments.some((a) => a.id === attachment.id)) return false
    this.#attachments.push(attachment)
    this.#pendingEvents.push(new OpportunityAttachmentAdded(attachment))
    return true
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
    const transition = OpportunityTransition.create({
      from,
      to: target,
      actorUserId,
      comment,
      createdAt: now,
    })
    this.#pendingEvents.push(new OpportunityTransitioned(transition))
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
    const verification = OpportunityVerification.create({
      from,
      to,
      decision,
      actorUserId,
      comment,
      createdAt: now,
    })
    this.#pendingEvents.push(new OpportunityVerified(verification))
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

function isCareerHubUrlAllowed(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl)
    return parsed.protocol === 'https:' && parsed.hostname === 'careerhub.rmit.edu.au'
  } catch {
    return false
  }
}

function isAllowedTransition(from: OpportunityStatus, to: OpportunityTransitionTarget): boolean {
  if (from === 'draft' && (to === 'published' || to === 'archived')) return true
  if (from === 'published' && to === 'archived') return true
  return false
}

export const OPPORTUNITY_SCHEMA_VERSION = 1 as const
