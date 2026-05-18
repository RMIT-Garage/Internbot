/**
 * Outbox row written inside the same Firestore transaction as a hard-delete of
 * an attachment subdoc. A separate worker drains the queue and deletes the
 * underlying GCS object using `filePath` + `storageGeneration` (the
 * `ifGenerationMatch` precondition keeps the delete safe across re-uploads).
 *
 * The aggregate emits `*AttachmentRemoved`; the repo materialises this VO and
 * persists it to `attachmentPurgeQueue/{auto}` in the same txn.
 */
export type AttachmentPurgeParent = 'internships' | 'opportunities'

export interface AttachmentPurgeRequestProps {
  readonly parentCollection: AttachmentPurgeParent
  readonly parentId: string
  readonly attachmentId: string
  readonly filePath: string
  readonly storageGeneration: string | undefined
  readonly requestedByUserId: string
  readonly requestedAt: Date
}

export class AttachmentPurgeRequest {
  #props: AttachmentPurgeRequestProps

  private constructor(props: AttachmentPurgeRequestProps) {
    this.#props = props
  }

  static create(props: AttachmentPurgeRequestProps): AttachmentPurgeRequest {
    return new AttachmentPurgeRequest(props)
  }

  get parentCollection(): AttachmentPurgeParent {
    return this.#props.parentCollection
  }
  get parentId(): string {
    return this.#props.parentId
  }
  get attachmentId(): string {
    return this.#props.attachmentId
  }
  get filePath(): string {
    return this.#props.filePath
  }
  get storageGeneration(): string | undefined {
    return this.#props.storageGeneration
  }
  get requestedByUserId(): string {
    return this.#props.requestedByUserId
  }
  get requestedAt(): Date {
    return this.#props.requestedAt
  }
}
