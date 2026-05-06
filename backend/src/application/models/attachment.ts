import type { Attachment } from '../../domain/value-objects/attachment'

export interface AttachmentDownloadResult {
  readonly attachment: Attachment
  readonly downloadUrl: string
  readonly downloadUrlExpiresAt: Date
}
