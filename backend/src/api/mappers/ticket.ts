import type { RequestActor } from '../../application/actor'
import type { CreateTicketCommand } from '../../application/commands/create-ticket'
import type { PostTicketReplyCommand } from '../../application/commands/post-ticket-reply'
import type { TransitionTicketCommand } from '../../application/commands/transition-ticket'
import type {
  ListTicketsQuery,
  TicketListResultWithCursor,
} from '../../application/queries/list-tickets'
import type { TicketResult } from '../../application/queries/get-ticket'
import type { TicketReplyResult } from '../../application/commands/post-ticket-reply'
import type { TicketListCursor } from '../../application/read-models/ticket'
import type { TicketStatus } from '../../domain/value-objects/ticket-enums'
import { ticketStatusValues } from '../../domain/value-objects/ticket-enums'
import type {
  CreateTicketRequest,
  PostTicketReplyRequest,
  TransitionTicketRequest,
} from '../schemas/ticket'
import type {
  TicketListItemResponse,
  TicketListResponse,
  TicketReplyResponse,
  TicketResponse,
} from '../dto/ticket'
import { formatETag, parseIfMatch } from '../utils/etag'
import { decodePageToken, encodePageToken } from '../utils/pagination'

export interface ParsedListTicketsQuery {
  query: ListTicketsQuery['filter']
  errors: { field: string; code: string; message: string }[]
}

const DEFAULT_SORT = { field: 'createdAt' as const, direction: 'desc' as const }

export function toCreateTicketCommand(
  actor: RequestActor,
  body: CreateTicketRequest
): CreateTicketCommand {
  return {
    actor,
    payload: {
      subject: body.subject,
      body: body.body,
      category: body.category,
    },
  }
}

export function toPostTicketReplyCommand(
  actor: RequestActor,
  ticketId: string,
  body: PostTicketReplyRequest
): PostTicketReplyCommand {
  return {
    actor,
    ticketId,
    text: body.text,
  }
}

export function toTransitionTicketCommand(
  actor: RequestActor,
  ticketId: string,
  ifMatch: string | undefined,
  body: TransitionTicketRequest
): TransitionTicketCommand {
  const expectedVersion = parseIfMatch(ifMatch)
  return {
    actor,
    ticketId,
    payload: {
      to: body.to,
      comment: body.comment,
    },
    ...(expectedVersion !== undefined ? { metadata: { expectedVersion } } : {}),
  }
}

export function parseListTicketsQuery(
  raw: Record<string, unknown>,
  limit: number
): ParsedListTicketsQuery {
  const errors: ParsedListTicketsQuery['errors'] = []
  const status = parseStatus(raw['status'], errors)
  const sort = parseSort(raw['sort'], errors)

  let cursor: TicketListCursor | undefined
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
        const lastValue = new Date(String(decoded.values[0]))
        if (Number.isNaN(lastValue.getTime())) {
          errors.push({ field: 'pageToken', code: 'invalid', message: 'pageToken is malformed' })
        } else {
          cursor = {
            sortField: 'createdAt',
            sortDirection: sort.direction,
            lastValue,
            lastDocId: decoded.path.split('/').pop() ?? '',
          }
        }
      }
    } catch {
      errors.push({ field: 'pageToken', code: 'invalid', message: 'pageToken is malformed' })
    }
  }

  return {
    query: {
      status,
      limit,
      sortDirection: sort.direction,
      cursor,
    },
    errors,
  }
}

function parseStatus(
  v: unknown,
  errors: ParsedListTicketsQuery['errors']
): TicketStatus | undefined {
  if (v === undefined) return undefined
  if (typeof v !== 'string' || !ticketStatusValues.includes(v as TicketStatus)) {
    errors.push({
      field: 'status',
      code: 'invalid',
      message: `status must be one of ${ticketStatusValues.join(', ')}`,
    })
    return undefined
  }
  return v as TicketStatus
}

function parseSort(
  v: unknown,
  errors: ParsedListTicketsQuery['errors']
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
    return DEFAULT_SORT
  }
  return { field, direction }
}

export function toTicketResponse(result: TicketResult): TicketResponse {
  const ticket = result.ticket
  return {
    id: ticket.id,
    userId: ticket.userId,
    subject: ticket.subject,
    body: ticket.body,
    category: ticket.category ?? null,
    status: ticket.status,
    version: ticket.version,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  }
}

export function toTicketListResponse(result: TicketListResultWithCursor): TicketListResponse {
  let nextPageToken: string | null = null
  if (result.cursor) {
    nextPageToken = encodePageToken({
      path: `tickets/${result.cursor.lastDocId}`,
      values: [result.cursor.lastValue.toISOString()],
      sort: `${result.cursor.sortField}:${result.cursor.sortDirection}`,
    })
  }
  return {
    items: result.items.map(
      (ticket): TicketListItemResponse => ({
        id: ticket.id,
        userId: ticket.userId,
        subject: ticket.subject,
        category: ticket.category ?? null,
        status: ticket.status,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
      })
    ),
    nextPageToken,
  }
}

export function toTicketReplyResponse(result: TicketReplyResult): TicketReplyResponse {
  const reply = result.reply
  return {
    id: reply.id,
    authorUserId: reply.authorUserId,
    authorRole: reply.authorRole,
    text: reply.text,
    createdAt: reply.createdAt.toISOString(),
  }
}

export function etagFromTicket(result: TicketResult): string {
  return formatETag(result.ticket.version)
}
