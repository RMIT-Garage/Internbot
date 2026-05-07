import { ConflictError, ValidationError } from '../errors'

export interface AttachmentProps {
  readonly id: string
  readonly filePath: string
  readonly fileName: string | undefined
  readonly contentType: string | undefined
  readonly uploadedAt: Date
  readonly storageGeneration: string | undefined
  /**
   * Soft-delete tombstone timestamp. When set, list/get queries hide this
   * attachment from API responses; the doc remains so a future outbox-driven
   * worker can delete the GCS object and (optionally) hard-delete the row.
   */
  readonly deletedAt: Date | undefined
  readonly deletedByUserId: string | undefined
}

export class Attachment {
  #props: AttachmentProps

  private constructor(props: AttachmentProps) {
    this.#props = props
  }

  static create(props: AttachmentProps): Attachment {
    validateRequiredText('id', props.id)
    validateRequiredText('filePath', props.filePath)
    if (props.fileName !== undefined) validateRequiredText('fileName', props.fileName)
    if (props.contentType !== undefined) validateRequiredText('contentType', props.contentType)
    return new Attachment(props)
  }

  static rehydrate(props: AttachmentProps): Attachment {
    return new Attachment(props)
  }

  get id(): string {
    return this.#props.id
  }

  get filePath(): string {
    return this.#props.filePath
  }

  get fileName(): string | undefined {
    return this.#props.fileName
  }

  get contentType(): string | undefined {
    return this.#props.contentType
  }

  get uploadedAt(): Date {
    return this.#props.uploadedAt
  }

  get storageGeneration(): string | undefined {
    return this.#props.storageGeneration
  }

  get deletedAt(): Date | undefined {
    return this.#props.deletedAt
  }

  get deletedByUserId(): string | undefined {
    return this.#props.deletedByUserId
  }

  get isDeleted(): boolean {
    return this.#props.deletedAt !== undefined
  }

  /**
   * Returns a new Attachment marked deleted. Throws if already deleted so the
   * aggregate can surface a clean 404 (the storage row remains until a future
   * outbox worker hard-deletes the GCS object).
   */
  markDeleted(deletedByUserId: string, deletedAt: Date): Attachment {
    if (this.#props.deletedAt !== undefined) {
      throw new ConflictError('Attachment already deleted', 'attachment_already_deleted')
    }
    return new Attachment({ ...this.#props, deletedAt, deletedByUserId })
  }
}

function validateRequiredText(field: string, value: string): void {
  if (value.trim().length === 0) {
    throw new ValidationError(`${field} is required`, 'invalid_attachment', [
      { field, code: 'required', message: `${field} cannot be empty` },
    ])
  }
}

export const ATTACHMENT_SCHEMA_VERSION = 1 as const
