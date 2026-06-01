import type { RequestActor } from '../../application/actor'
import type { InternshipOfferDetails } from '../../domain/entities/internship'
import type { CreateInternshipCommand } from '../../application/commands/create-internship'
import type { UpdateInternshipCommand } from '../../application/commands/update-internship'
import type { SubmitInternshipOfferCommand } from '../../application/commands/submit-internship-offer'
import type { AddInternshipCommentCommand } from '../../application/commands/add-internship-comment'
import type { DecideInternshipOfferCommand } from '../../application/commands/decide-internship-offer'
import type { WithdrawInternshipCommand } from '../../application/commands/withdraw-internship'
import type {
  InternshipListResultWithCursor,
  ListInternshipsQuery,
} from '../../application/queries/list-internships'
import type { InternshipActivityResult } from '../../application/commands/add-internship-comment'
import type { InternshipResult } from '../../application/queries/get-internship'
import type { AttachmentDownloadResult } from '../../application/queries/get-internship-attachment'
import type {
  CreateInternshipAttachmentUploadIntentCommand,
  CreateInternshipAttachmentUploadIntentResult,
} from '../../application/commands/create-internship-attachment-upload-intent'
import type {
  InternshipListCursor,
  InternshipReadModel,
} from '../../application/read-models/internship'
import type { InternshipStatus } from '../../domain/value-objects/internship-enums'
import { internshipStatusValues } from '../../domain/value-objects/internship-enums'
import type {
  AddInternshipCommentRequest,
  CreateInternshipAttachmentUploadIntentRequest,
  CreateInternshipRequest,
  DecideInternshipOfferRequest,
  PatchInternshipRequest,
  SubmitInternshipOfferRequest,
} from '../schemas/internship'
import type {
  InternshipActivityResponse,
  InternshipAttachmentDownloadResponse,
  InternshipAttachmentUploadIntentResponse,
  InternshipListItemResponse,
  InternshipListResponse,
  InternshipResponse,
} from '../dto/internship'
import { formatETag, parseIfMatch } from '../utils/etag'
import { decodePageToken, encodePageToken } from '../utils/pagination'

export function toCreateInternshipCommand(
  actor: RequestActor,
  body: CreateInternshipRequest
): CreateInternshipCommand {
  return {
    actor,
    payload: {
      opportunityId: body.opportunityId,
    },
  }
}

export function toUpdateInternshipCommand(
  actor: RequestActor,
  internshipId: string,
  ifMatch: string | undefined,
  body: PatchInternshipRequest
): UpdateInternshipCommand {
  const patch: MutableOfferDetails = {}
  if (body.offerDate !== undefined) patch.offerDate = new Date(body.offerDate)
  if (body.startDate !== undefined) patch.startDate = new Date(body.startDate)
  if (body.endDate !== undefined) {
    patch.endDate = body.endDate === null ? undefined : new Date(body.endDate)
  }
  const expectedVersion = parseIfMatch(ifMatch)
  return {
    actor,
    internshipId,
    patch,
    ...(expectedVersion !== undefined ? { metadata: { expectedVersion } } : {}),
  }
}

type MutableOfferDetails = {
  -readonly [K in keyof InternshipOfferDetails]?: InternshipOfferDetails[K]
}

export function toSubmitInternshipOfferCommand(
  actor: RequestActor,
  internshipId: string,
  ifMatch: string | undefined,
  body: SubmitInternshipOfferRequest
): SubmitInternshipOfferCommand {
  const expectedVersion = parseIfMatch(ifMatch)
  return {
    actor,
    internshipId,
    payload: {
      offerDate: body.offerDate === undefined ? undefined : new Date(body.offerDate),
      startDate: body.startDate === undefined ? undefined : new Date(body.startDate),
      endDate:
        body.endDate === null || body.endDate === undefined ? undefined : new Date(body.endDate),
    },
    ...(expectedVersion !== undefined ? { metadata: { expectedVersion } } : {}),
  }
}

export function toWithdrawInternshipCommand(
  actor: RequestActor,
  internshipId: string,
  ifMatch: string | undefined
): WithdrawInternshipCommand {
  const expectedVersion = parseIfMatch(ifMatch)
  return {
    actor,
    internshipId,
    ...(expectedVersion !== undefined ? { metadata: { expectedVersion } } : {}),
  }
}

export function toAddInternshipCommentCommand(
  actor: RequestActor,
  internshipId: string,
  body: AddInternshipCommentRequest
): AddInternshipCommentCommand {
  return {
    actor,
    internshipId,
    text: body.text,
  }
}

export function toDecideInternshipOfferCommand(
  actor: RequestActor,
  internshipId: string,
  ifMatch: string | undefined,
  body: DecideInternshipOfferRequest
): DecideInternshipOfferCommand {
  const expectedVersion = parseIfMatch(ifMatch)
  return {
    actor,
    internshipId,
    payload: {
      decision: body.decision,
      comment: body.comment,
    },
    ...(expectedVersion !== undefined ? { metadata: { expectedVersion } } : {}),
  }
}

export interface ParsedListInternshipsQuery {
  query: ListInternshipsQuery['filter']
  errors: { field: string; code: string; message: string }[]
}

const DEFAULT_SORT = { field: 'createdAt' as const, direction: 'desc' as const }

export function parseListInternshipsQuery(
  raw: Record<string, unknown>,
  limit: number
): ParsedListInternshipsQuery {
  const errors: ParsedListInternshipsQuery['errors'] = []
  const userId = stringOrUndefined(raw['userId'], 'userId', errors)
  const opportunityId = stringOrUndefined(raw['opportunityId'], 'opportunityId', errors)
  const status = parseStatusFilter(raw['status'], errors)
  const sort = parseSort(raw['sort'], errors)

  let cursor: InternshipListCursor | undefined
  if (typeof raw['pageToken'] === 'string' && raw['pageToken'].length > 0) {
    try {
      const decoded = decodePageToken(raw['pageToken'])
      const expectedSort = `${sort.field}:${sort.direction}`
      if (decoded.sort !== undefined && decoded.sort !== expectedSort) {
        errors.push({
          field: 'pageToken',
          code: 'sort_mismatch',
          message: `pageToken was issued for sort=${decoded.sort} but request specifies ${expectedSort}`,
        })
      } else {
        cursor = {
          sortField: sort.field,
          sortDirection: sort.direction,
          lastValue:
            decoded.values[0] === null || decoded.values[0] === undefined
              ? null
              : new Date(String(decoded.values[0])),
          lastDocId: decoded.path.split('/').pop() ?? '',
        }
      }
    } catch {
      errors.push({ field: 'pageToken', code: 'invalid', message: 'pageToken is malformed' })
    }
  }

  return {
    query: {
      userId,
      opportunityId,
      status,
      limit,
      sortField: sort.field,
      sortDirection: sort.direction,
      cursor,
    },
    errors,
  }
}

function stringOrUndefined(
  v: unknown,
  field: string,
  errors: ParsedListInternshipsQuery['errors']
): string | undefined {
  if (v === undefined) return undefined
  if (typeof v === 'string') return v
  errors.push({ field, code: 'invalid', message: `${field} must be a string` })
  return undefined
}

function parseStatusFilter(
  v: unknown,
  errors: ParsedListInternshipsQuery['errors']
): readonly InternshipStatus[] | undefined {
  if (v === undefined) return undefined
  const raw = Array.isArray(v) ? v : [v]
  const allowed = new Set<string>(internshipStatusValues)
  const out: InternshipStatus[] = []
  for (const item of raw) {
    if (typeof item !== 'string' || !allowed.has(item)) {
      errors.push({
        field: 'status',
        code: 'invalid',
        message: `status must be one of ${internshipStatusValues.join(', ')}`,
      })
      return undefined
    }
    out.push(item as InternshipStatus)
  }
  return out.length > 0 ? out : undefined
}

function parseSort(
  v: unknown,
  errors: ParsedListInternshipsQuery['errors']
): { field: 'createdAt' | 'lastSubmittedAt'; direction: 'asc' | 'desc' } {
  if (v === undefined) return DEFAULT_SORT
  if (typeof v !== 'string') {
    errors.push({ field: 'sort', code: 'invalid', message: 'sort must be a string' })
    return DEFAULT_SORT
  }
  const direction = v.startsWith('-') ? 'desc' : 'asc'
  const field = v.startsWith('-') ? v.slice(1) : v
  if (field !== 'createdAt' && field !== 'lastSubmittedAt') {
    errors.push({
      field: 'sort',
      code: 'invalid',
      message: 'sort must be one of: createdAt, -createdAt, lastSubmittedAt, -lastSubmittedAt',
    })
    return DEFAULT_SORT
  }
  return { field, direction }
}

function dateToIso(d: Date | undefined): string | null {
  return d ? d.toISOString() : null
}

function readModelToResponse(model: InternshipReadModel): InternshipResponse {
  const internship = model.internship
  return {
    id: internship.id,
    userId: internship.userId,
    opportunityId: internship.opportunityId,
    studentProgramCode: model.studentProgramCode ?? null,
    opportunityEmployerName: model.opportunityEmployerName,
    opportunityJobTitle: model.opportunityJobTitle,
    opportunityType: model.opportunityType,
    opportunitySourceUrl: model.opportunitySourceUrl ?? null,
    semesterId: model.semesterId,
    semesterDisplayName: model.semesterDisplayName,
    semesterCode: model.semesterCode,
    status: internship.status,
    version: internship.version,
    coordinatorDecision: internship.coordinatorDecision ?? null,
    coordinatorComment: internship.coordinatorComment ?? null,
    reviewedByUserId: internship.reviewedByUserId ?? null,
    reviewedAt: dateToIso(internship.reviewedAt),
    offerDate: dateToIso(internship.offerDate),
    startDate: dateToIso(internship.startDate),
    endDate: dateToIso(internship.endDate),
    attachmentUploadPathPrefix: `users/${internship.userId}/internships/${internship.id}/attachments/`,
    attachments: model.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName ?? null,
      contentType: a.contentType ?? null,
      uploadedAt: a.uploadedAt.toISOString(),
      uploadStatus: a.uploadStatus,
    })),
    lastSubmittedAt: dateToIso(internship.lastSubmittedAt),
    createdAt: internship.createdAt.toISOString(),
    updatedAt: internship.updatedAt.toISOString(),
  }
}

function readModelToListItem(model: InternshipReadModel): InternshipListItemResponse {
  const response = readModelToResponse(model)
  return {
    id: response.id,
    userId: response.userId,
    opportunityId: response.opportunityId,
    studentProgramCode: response.studentProgramCode,
    opportunityEmployerName: response.opportunityEmployerName,
    opportunityJobTitle: response.opportunityJobTitle,
    opportunityType: response.opportunityType,
    opportunitySourceUrl: response.opportunitySourceUrl,
    semesterId: response.semesterId,
    semesterDisplayName: response.semesterDisplayName,
    semesterCode: response.semesterCode,
    status: response.status,
    lastSubmittedAt: response.lastSubmittedAt,
    createdAt: response.createdAt,
  }
}

export function toInternshipResponse(result: InternshipResult): InternshipResponse {
  return readModelToResponse(result)
}

export function toInternshipAttachmentDownloadResponse(
  result: AttachmentDownloadResult
): InternshipAttachmentDownloadResponse {
  return {
    id: result.attachment.id,
    fileName: result.attachment.fileName ?? null,
    contentType: result.attachment.contentType ?? null,
    uploadedAt: result.attachment.uploadedAt.toISOString(),
    uploadStatus: result.attachment.uploadStatus,
    downloadUrl: result.downloadUrl,
    downloadUrlExpiresAt: result.downloadUrlExpiresAt.toISOString(),
  }
}

export function toCreateInternshipAttachmentUploadIntentCommand(
  actor: RequestActor,
  internshipId: string,
  body: CreateInternshipAttachmentUploadIntentRequest
): CreateInternshipAttachmentUploadIntentCommand {
  return {
    actor,
    internshipId,
    fileName: body.fileName,
    contentType: body.contentType,
  }
}

export function toInternshipAttachmentUploadIntentResponse(
  result: CreateInternshipAttachmentUploadIntentResult,
  contentType: string
): InternshipAttachmentUploadIntentResponse {
  return {
    attachmentId: result.attachmentId,
    filePath: result.filePath,
    uploadUrl: result.uploadUrl,
    uploadExpiresAt: result.uploadExpiresAt.toISOString(),
    contentType,
  }
}

export function toInternshipListResponse(
  result: InternshipListResultWithCursor
): InternshipListResponse {
  let nextPageToken: string | null = null
  if (result.cursor) {
    nextPageToken = encodePageToken({
      path: `internships/${result.cursor.lastDocId}`,
      values: [result.cursor.lastValue ? result.cursor.lastValue.toISOString() : null],
      sort: `${result.cursor.sortField}:${result.cursor.sortDirection}`,
    })
  }
  return { items: result.items.map(readModelToListItem), nextPageToken }
}

export function toInternshipActivityResponse(
  result: InternshipActivityResult
): InternshipActivityResponse {
  const activity = result.activity
  return {
    id: activity.id,
    type: activity.type,
    authorUserId: activity.authorUserId,
    authorRole: activity.authorRole,
    text: activity.text ?? null,
    createdAt: activity.createdAt.toISOString(),
  }
}

export function etagFromInternship(result: InternshipResult): string {
  return formatETag(result.internship.version)
}
