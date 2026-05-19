/**
 * Parses GCS object paths the upload-intent endpoints construct. The intent
 * embeds the server-generated attachment id as the leaf-filename prefix so the
 * `OBJECT_FINALIZE` event handler can locate the matching Firestore subdoc
 * without a collection-group query.
 *
 * Path shape:
 *   - opportunities/{opportunityId}/attachments/{attachmentId}-{fileName}
 *   - users/{userId}/internships/{internshipId}/attachments/{attachmentId}-{fileName}
 *
 * `userId` is included for the internship branch as a defense-in-depth check —
 * the finalize worker can confirm the parent internship's `userId` matches what
 * the signed-URL minter encoded.
 */
export type AttachmentStoragePath =
  | {
      readonly kind: 'opportunity'
      readonly opportunityId: string
      readonly attachmentId: string
      readonly filePath: string
    }
  | {
      readonly kind: 'internship'
      readonly userId: string
      readonly internshipId: string
      readonly attachmentId: string
      readonly filePath: string
    }

const OPPORTUNITY_ATTACHMENT_RE = /^opportunities\/([^/]+)\/attachments\/([^/]+)$/
const INTERNSHIP_ATTACHMENT_RE = /^users\/([^/]+)\/internships\/([^/]+)\/attachments\/([^/]+)$/
const ATTACHMENT_ID_RE = /^(att_[A-Za-z0-9_-]+)-/

export function parseAttachmentStoragePath(raw: string): AttachmentStoragePath | null {
  const opportunity = OPPORTUNITY_ATTACHMENT_RE.exec(raw)
  if (opportunity) {
    const attachmentId = extractAttachmentId(opportunity[2]!)
    if (!attachmentId) return null
    return {
      kind: 'opportunity',
      opportunityId: safeDecode(opportunity[1]!),
      attachmentId,
      filePath: raw,
    }
  }

  const internship = INTERNSHIP_ATTACHMENT_RE.exec(raw)
  if (internship) {
    const attachmentId = extractAttachmentId(internship[3]!)
    if (!attachmentId) return null
    return {
      kind: 'internship',
      userId: safeDecode(internship[1]!),
      internshipId: safeDecode(internship[2]!),
      attachmentId,
      filePath: raw,
    }
  }

  return null
}

function extractAttachmentId(leaf: string): string | null {
  const match = ATTACHMENT_ID_RE.exec(leaf)
  return match ? match[1]! : null
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
