export type AttachmentStoragePath =
  | {
      readonly kind: 'opportunity'
      readonly opportunityId: string
      readonly fileName: string
      readonly filePath: string
    }
  | {
      readonly kind: 'internship'
      readonly userId: string
      readonly internshipId: string
      readonly fileName: string
      readonly filePath: string
    }

const OPPORTUNITY_ATTACHMENT_RE = /^opportunities\/([^/]+)\/attachments\/([^/]+)$/
const INTERNSHIP_ATTACHMENT_RE = /^users\/([^/]+)\/internships\/([^/]+)\/attachments\/([^/]+)$/

export function parseAttachmentStoragePath(raw: string): AttachmentStoragePath | null {
  const opportunity = OPPORTUNITY_ATTACHMENT_RE.exec(raw)
  if (opportunity) {
    return {
      kind: 'opportunity',
      opportunityId: safeDecode(opportunity[1]!),
      fileName: safeDecode(opportunity[2]!),
      filePath: raw,
    }
  }

  const internship = INTERNSHIP_ATTACHMENT_RE.exec(raw)
  if (internship) {
    return {
      kind: 'internship',
      userId: safeDecode(internship[1]!),
      internshipId: safeDecode(internship[2]!),
      fileName: safeDecode(internship[3]!),
      filePath: raw,
    }
  }

  return null
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
