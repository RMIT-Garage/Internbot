import { ValidationError } from '../errors'

export interface AttachmentProps {
  readonly id: string
  readonly filePath: string
  readonly fileName: string | undefined
  readonly contentType: string | undefined
  readonly uploadedAt: Date
  readonly storageGeneration: string | undefined
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
}

function validateRequiredText(field: string, value: string): void {
  if (value.trim().length === 0) {
    throw new ValidationError(`${field} is required`, 'invalid_attachment', [
      { field, code: 'required', message: `${field} cannot be empty` },
    ])
  }
}

export const ATTACHMENT_SCHEMA_VERSION = 1 as const
