import type { RequestActor } from '../../application/actor'
import type {
  ListOpportunitiesQuery,
  OpportunityListResultWithCursor,
} from '../../application/queries/list-opportunities'
import type { OpportunityResult } from '../../application/queries/get-opportunity'
import type { AttachmentDownloadResult } from '../../application/queries/get-internship-attachment'
import type { CreateOpportunityCommand } from '../../application/commands/create-opportunity'
import type { UpdateOpportunityCommand } from '../../application/commands/update-opportunity'
import type { TransitionOpportunityCommand } from '../../application/commands/transition-opportunity'
import type { VerifyOpportunityCommand } from '../../application/commands/verify-opportunity'
import type {
  OpportunityListCursor,
  OpportunityReadModel,
} from '../../application/read-models/opportunity'
import type {
  OpportunityStatus,
  OpportunityType,
} from '../../domain/value-objects/opportunity-enums'
import {
  opportunityStatusValues,
  opportunityTypeValues,
} from '../../domain/value-objects/opportunity-enums'
import type {
  CreateOpportunityRequest,
  PatchOpportunityRequest,
  TransitionOpportunityRequest,
  VerifyOpportunityRequest,
} from '../schemas/opportunity'
import type {
  OpportunityAttachmentDownloadResponse,
  OpportunityListResponse,
  OpportunityResponse,
} from '../dto/opportunity'
import { formatETag, parseIfMatch } from '../utils/etag'
import { decodePageToken, encodePageToken } from '../utils/pagination'

export function toCreateOpportunityCommand(
  actor: RequestActor,
  body: CreateOpportunityRequest
): CreateOpportunityCommand {
  return {
    actor,
    payload: {
      semesterId: body.semesterId,
      type: body.type,
      employerName: body.employerName,
      jobTitle: body.jobTitle,
      descriptionText: body.descriptionText,
      workMode: body.workMode,
      location: body.location,
      sourceUrl: body.sourceUrl,
    },
  }
}

export function toUpdateOpportunityCommand(
  actor: RequestActor,
  opportunityId: string,
  ifMatch: string | undefined,
  body: PatchOpportunityRequest
): UpdateOpportunityCommand {
  const patch: UpdateOpportunityCommand['patch'] = {}
  if (body.employerName !== undefined) patch.employerName = body.employerName
  if (body.jobTitle !== undefined) patch.jobTitle = body.jobTitle
  if (body.descriptionText !== undefined) patch.descriptionText = body.descriptionText
  if (body.workMode !== undefined) patch.workMode = body.workMode
  if (body.location !== undefined) patch.location = body.location
  if (body.sourceUrl !== undefined) patch.sourceUrl = body.sourceUrl
  const expectedVersion = parseIfMatch(ifMatch)
  return {
    actor,
    opportunityId,
    patch,
    ...(expectedVersion !== undefined ? { metadata: { expectedVersion } } : {}),
  }
}

export function toTransitionOpportunityCommand(
  actor: RequestActor,
  opportunityId: string,
  ifMatch: string | undefined,
  body: TransitionOpportunityRequest
): TransitionOpportunityCommand {
  const expectedVersion = parseIfMatch(ifMatch)
  return {
    actor,
    opportunityId,
    to: body.to,
    comment: body.comment,
    ...(expectedVersion !== undefined ? { metadata: { expectedVersion } } : {}),
  }
}

export function toVerifyOpportunityCommand(
  actor: RequestActor,
  opportunityId: string,
  ifMatch: string | undefined,
  body: VerifyOpportunityRequest
): VerifyOpportunityCommand {
  const expectedVersion = parseIfMatch(ifMatch)
  return {
    actor,
    opportunityId,
    decision: body.decision,
    comment: body.comment,
    ...(expectedVersion !== undefined ? { metadata: { expectedVersion } } : {}),
  }
}

export interface ParsedListOpportunitiesQuery {
  query: ListOpportunitiesQuery['filter']
  errors: { field: string; code: string; message: string }[]
}

const DEFAULT_SORT = { field: 'createdAt' as const, direction: 'desc' as const }

export function parseListOpportunitiesQuery(
  raw: Record<string, unknown>,
  limit: number
): ParsedListOpportunitiesQuery {
  const errors: ParsedListOpportunitiesQuery['errors'] = []
  const semesterId = stringOrUndefined(raw['semesterId'], 'semesterId', errors)
  const status = parseStatusFilter(raw['status'], errors)
  const type = parseTypeFilter(raw['type'], errors)
  const sort = parseSort(raw['sort'], errors)

  let cursor: OpportunityListCursor | undefined
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
      semesterId,
      status,
      type,
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
  errors: ParsedListOpportunitiesQuery['errors']
): string | undefined {
  if (v === undefined) return undefined
  if (typeof v === 'string') return v
  errors.push({ field, code: 'invalid', message: `${field} must be a string` })
  return undefined
}

function parseStatusFilter(
  v: unknown,
  errors: ParsedListOpportunitiesQuery['errors']
): readonly OpportunityStatus[] | undefined {
  if (v === undefined) return undefined
  const raw = Array.isArray(v) ? v : [v]
  const allowed = new Set<string>(opportunityStatusValues)
  const out: OpportunityStatus[] = []
  for (const item of raw) {
    if (typeof item !== 'string' || !allowed.has(item)) {
      errors.push({
        field: 'status',
        code: 'invalid',
        message: `status must be one of ${opportunityStatusValues.join(', ')}`,
      })
      return undefined
    }
    out.push(item as OpportunityStatus)
  }
  return out.length > 0 ? out : undefined
}

function parseTypeFilter(
  v: unknown,
  errors: ParsedListOpportunitiesQuery['errors']
): OpportunityType | undefined {
  if (v === undefined) return undefined
  if (typeof v !== 'string' || !new Set<string>(opportunityTypeValues).has(v)) {
    errors.push({
      field: 'type',
      code: 'invalid',
      message: `type must be one of ${opportunityTypeValues.join(', ')}`,
    })
    return undefined
  }
  return v as OpportunityType
}

function parseSort(
  v: unknown,
  errors: ParsedListOpportunitiesQuery['errors']
): { field: 'createdAt'; direction: 'asc' | 'desc' } {
  if (v === undefined) return DEFAULT_SORT
  if (typeof v !== 'string') {
    errors.push({ field: 'sort', code: 'invalid', message: 'sort must be a string' })
    return DEFAULT_SORT
  }
  const direction = v.startsWith('-') ? 'desc' : 'asc'
  const field = v.startsWith('-') ? v.slice(1) : v
  if (field !== 'createdAt') {
    errors.push({
      field: 'sort',
      code: 'invalid',
      message: 'sort must be one of: createdAt, -createdAt',
    })
  }
  return { field: 'createdAt', direction }
}

function dateToIso(d: Date | undefined): string | null {
  return d ? d.toISOString() : null
}

function readModelToResponse(model: OpportunityReadModel): OpportunityResponse {
  const opportunity = model.opportunity
  return {
    id: opportunity.id,
    semesterId: opportunity.semesterId,
    type: opportunity.type,
    employerName: opportunity.employerName,
    jobTitle: opportunity.jobTitle,
    descriptionText: opportunity.descriptionText,
    workMode: opportunity.workMode ?? null,
    location: opportunity.location ?? null,
    sourceUrl: opportunity.sourceUrl ?? null,
    status: opportunity.status,
    applicationCount: model.applicationCount,
    createdByUserId: opportunity.createdByUserId ?? null,
    submittedByUserId: opportunity.submittedByUserId ?? null,
    verifiedByUserId: opportunity.verifiedByUserId ?? null,
    verifiedAt: dateToIso(opportunity.verifiedAt),
    attachmentUploadPathPrefix: `opportunities/${opportunity.id}/attachments/`,
    attachments: model.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName ?? null,
      contentType: a.contentType ?? null,
      uploadedAt: a.uploadedAt.toISOString(),
    })),
    createdAt: opportunity.createdAt.toISOString(),
    updatedAt: opportunity.updatedAt.toISOString(),
  }
}

export function toOpportunityResponse(result: OpportunityResult): OpportunityResponse {
  return readModelToResponse(result)
}

export function toOpportunityAttachmentDownloadResponse(
  result: AttachmentDownloadResult
): OpportunityAttachmentDownloadResponse {
  return {
    id: result.attachment.id,
    fileName: result.attachment.fileName ?? null,
    contentType: result.attachment.contentType ?? null,
    uploadedAt: result.attachment.uploadedAt.toISOString(),
    downloadUrl: result.downloadUrl,
    downloadUrlExpiresAt: result.downloadUrlExpiresAt.toISOString(),
  }
}

export function toOpportunityListResponse(
  result: OpportunityListResultWithCursor
): OpportunityListResponse {
  let nextPageToken: string | null = null
  if (result.cursor) {
    nextPageToken = encodePageToken({
      path: `opportunities/${result.cursor.lastDocId}`,
      values: [result.cursor.lastValue ? result.cursor.lastValue.toISOString() : null],
      sort: `${result.cursor.sortField}:${result.cursor.sortDirection}`,
    })
  }
  return { items: result.items.map(readModelToResponse), nextPageToken }
}

export function etagFromOpportunity(result: OpportunityResult): string {
  return formatETag(result.opportunity.version)
}
