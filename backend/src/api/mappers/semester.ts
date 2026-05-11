import type { RequestActor } from '../../application/actor'
import type { SemesterResult, SemesterListResult } from '../../application/models/semester'
import type { CreateSemesterCommand } from '../../application/commands/create-semester'
import type { UpdateSemesterCommand } from '../../application/commands/update-semester'
import type { TransitionSemesterCommand } from '../../application/commands/transition-semester'
import type { ListSemestersQuery } from '../../application/queries/list-semesters'
import type { SemesterListCursor } from '../../domain/repositories/semester-repository'
import type { Semester } from '../../domain/entities/semester'
import type { SemesterStatus } from '../../domain/value-objects/semester-enums'
import type {
  CreateSemesterRequest,
  PatchSemesterRequest,
  TransitionSemesterRequest,
} from '../schemas/semester'
import type { SemesterResponse, SemesterListResponse } from '../dto/semester'
import { formatETag, parseIfMatch } from '../utils/etag'
import { encodePageToken, decodePageToken } from '../utils/pagination'
import { semesterStatusValues } from '../../domain/value-objects/semester-enums'

// ---------------------------- request → command ----------------------------

export function toCreateSemesterCommand(
  actor: RequestActor,
  body: CreateSemesterRequest
): CreateSemesterCommand {
  return {
    actor,
    payload: {
      semesterCode: body.semesterCode,
      courseCode: body.courseCode,
      displayName: body.displayName,
      status: body.status,
      enrolmentOpenAt: body.enrolmentOpenAt ? new Date(body.enrolmentOpenAt) : undefined,
      enrolmentCloseAt: body.enrolmentCloseAt ? new Date(body.enrolmentCloseAt) : undefined,
    },
  }
}

export function toUpdateSemesterCommand(
  actor: RequestActor,
  semesterId: string,
  ifMatch: string | undefined,
  body: PatchSemesterRequest
): UpdateSemesterCommand {
  const patch: UpdateSemesterCommand['patch'] = {}
  if (body.displayName !== undefined) patch.displayName = body.displayName
  if (body.enrolmentOpenAt !== undefined) {
    patch.enrolmentOpenAt = body.enrolmentOpenAt === null ? null : new Date(body.enrolmentOpenAt)
  }
  if (body.enrolmentCloseAt !== undefined) {
    patch.enrolmentCloseAt = body.enrolmentCloseAt === null ? null : new Date(body.enrolmentCloseAt)
  }

  const expectedVersion = parseIfMatch(ifMatch)
  return {
    actor,
    semesterId,
    patch,
    ...(expectedVersion !== undefined ? { metadata: { expectedVersion } } : {}),
  }
}

export function toTransitionSemesterCommand(
  actor: RequestActor,
  semesterId: string,
  ifMatch: string | undefined,
  body: TransitionSemesterRequest
): TransitionSemesterCommand {
  const expectedVersion = parseIfMatch(ifMatch)
  return {
    actor,
    semesterId,
    to: body.to,
    comment: body.comment,
    ...(expectedVersion !== undefined ? { metadata: { expectedVersion } } : {}),
  }
}

// ---------------------------- query parsing -----------------------------

export interface ParsedListQuery {
  query: ListSemestersQuery['filter']
  errors: { field: string; code: string; message: string }[]
}

const ALLOWED_SORT_FIELDS = new Set<'createdAt' | 'enrolmentOpenAt'>([
  'createdAt',
  'enrolmentOpenAt',
])
const DEFAULT_SORT: { field: 'createdAt' | 'enrolmentOpenAt'; direction: 'asc' | 'desc' } = {
  field: 'createdAt',
  direction: 'desc',
}

/**
 * Parse the wire-level query string into the typed `ListSemestersQuery`
 * filter shape. Returns a structured-error list rather than throwing —
 * the route surfaces them as a single 400.
 */
export function parseListSemestersQuery(
  raw: Record<string, unknown>,
  limit: number
): ParsedListQuery {
  const errors: ParsedListQuery['errors'] = []

  const status = parseStatusFilter(raw['status'], errors)
  const semesterCode = stringOrUndefined(raw['semesterCode'], 'semesterCode', errors)
  const courseCode = stringOrUndefined(raw['courseCode'], 'courseCode', errors)

  const sort = parseSort(raw['sort'], errors)

  let cursor: SemesterListCursor | undefined
  if (typeof raw['pageToken'] === 'string' && raw['pageToken'].length > 0) {
    try {
      const decoded = decodePageToken(raw['pageToken'])
      // Cursor↔sort binding: a token minted under one sort key cannot be
      // resumed under another. Mixing them silently produces undefined
      // Firestore ordering (`startAfter` values are interpreted against the
      // *current* `orderBy`, not the original) — the kind of bug that drops
      // documents from the middle of paginated lists.
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
      errors.push({
        field: 'pageToken',
        code: 'invalid',
        message: 'pageToken is malformed',
      })
    }
  }

  return {
    query: {
      status,
      semesterCode,
      courseCode,
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
  errors: ParsedListQuery['errors']
): string | undefined {
  if (v === undefined) return undefined
  if (typeof v === 'string') return v
  errors.push({ field, code: 'invalid', message: `${field} must be a string` })
  return undefined
}

function parseStatusFilter(
  v: unknown,
  errors: ParsedListQuery['errors']
): readonly SemesterStatus[] | undefined {
  if (v === undefined) return undefined
  const raw = Array.isArray(v) ? v : [v]
  const allowed = new Set<string>(semesterStatusValues)
  const out: SemesterStatus[] = []
  for (const item of raw) {
    if (typeof item !== 'string' || !allowed.has(item)) {
      errors.push({
        field: 'status',
        code: 'invalid',
        message: `status must be one of ${semesterStatusValues.join(', ')}`,
      })
      return undefined
    }
    out.push(item as SemesterStatus)
  }
  return out.length > 0 ? out : undefined
}

function parseSort(
  v: unknown,
  errors: ParsedListQuery['errors']
): { field: 'createdAt' | 'enrolmentOpenAt'; direction: 'asc' | 'desc' } {
  if (v === undefined) return DEFAULT_SORT
  if (typeof v !== 'string') {
    errors.push({ field: 'sort', code: 'invalid', message: 'sort must be a string' })
    return DEFAULT_SORT
  }
  const direction = v.startsWith('-') ? 'desc' : 'asc'
  const field = v.startsWith('-') ? v.slice(1) : v
  if (!ALLOWED_SORT_FIELDS.has(field as 'createdAt' | 'enrolmentOpenAt')) {
    errors.push({
      field: 'sort',
      code: 'invalid',
      message: `sort must be one of: createdAt, -createdAt, enrolmentOpenAt, -enrolmentOpenAt`,
    })
    return DEFAULT_SORT
  }
  return { field: field as 'createdAt' | 'enrolmentOpenAt', direction }
}

// ---------------------------- result → response ----------------------------

function dateToIso(d: Date | undefined): string | null {
  return d ? d.toISOString() : null
}

export function toSemesterResponse(result: SemesterResult): SemesterResponse {
  return semesterToResponse(result.semester)
}

export function toSemesterListResponse(
  result: SemesterListResult & { cursor: SemesterListCursor | null }
): SemesterListResponse {
  const items = result.items.map(semesterToResponse)
  let nextPageToken: string | null = null
  if (result.cursor) {
    nextPageToken = encodePageToken({
      path: `semesters/${result.cursor.lastDocId}`,
      values: [result.cursor.lastValue ? result.cursor.lastValue.toISOString() : null],
      sort: `${result.cursor.sortField}:${result.cursor.sortDirection}`,
    })
  }
  return { items, nextPageToken }
}

function semesterToResponse(s: Semester): SemesterResponse {
  return {
    id: s.id,
    semesterCode: s.semesterCode,
    courseCode: s.courseCode,
    displayName: s.displayName,
    status: s.status,
    enrolmentOpenAt: dateToIso(s.enrolmentOpenAt),
    enrolmentCloseAt: dateToIso(s.enrolmentCloseAt),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }
}

export function etagFromSemester(result: SemesterResult): string {
  return formatETag(result.semester.version)
}
