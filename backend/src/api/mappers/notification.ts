import type { RequestActor } from '../../application/actor'
import type { NotificationListResultWithCursor } from '../../application/queries/list-notifications'
import type { NotificationResult } from '../../application/queries/get-notification'
import type { MarkNotificationReadCommand } from '../../application/commands/mark-notification-read'
import type { MarkAllNotificationsReadCommand } from '../../application/commands/mark-all-notifications-read'
import type { NotificationListCursor } from '../../application/read-models/notification'
import type {
  MarkAllNotificationsReadResponse,
  NotificationListResponse,
  NotificationResponse,
} from '../dto/notification'
import { decodePageToken, encodePageToken } from '../utils/pagination'

export interface ParsedListNotificationsQuery {
  query: {
    unreadOnly: boolean
    limit: number
    cursor: NotificationListCursor | undefined
  }
  errors: { field: string; code: string; message: string }[]
}

export function toMarkNotificationReadCommand(
  actor: RequestActor,
  notificationId: string
): MarkNotificationReadCommand {
  return { actor, notificationId }
}

export function toMarkAllNotificationsReadCommand(
  actor: RequestActor
): MarkAllNotificationsReadCommand {
  return { actor }
}

export function parseListNotificationsQuery(
  raw: Record<string, unknown>,
  limit: number
): ParsedListNotificationsQuery {
  const errors: ParsedListNotificationsQuery['errors'] = []
  const unreadOnly = parseUnreadOnly(raw['unreadOnly'], errors)

  let cursor: NotificationListCursor | undefined
  if (typeof raw['pageToken'] === 'string' && raw['pageToken'].length > 0) {
    try {
      const decoded = decodePageToken(raw['pageToken'])
      const expectedSort = 'createdAt:desc'
      const lastValue = new Date(String(decoded.values[0]))
      if (decoded.sort !== undefined && decoded.sort !== expectedSort) {
        errors.push({
          field: 'pageToken',
          code: 'sort_mismatch',
          message: `pageToken was issued for sort=${decoded.sort} but request specifies ${expectedSort}`,
        })
      } else if (Number.isNaN(lastValue.getTime())) {
        errors.push({ field: 'pageToken', code: 'invalid', message: 'pageToken is malformed' })
      } else {
        cursor = {
          sortField: 'createdAt',
          sortDirection: 'desc',
          lastValue,
          lastDocId: decoded.path.split('/').pop() ?? '',
        }
      }
    } catch {
      errors.push({ field: 'pageToken', code: 'invalid', message: 'pageToken is malformed' })
    }
  }

  return {
    query: {
      unreadOnly,
      limit,
      cursor,
    },
    errors,
  }
}

function parseUnreadOnly(v: unknown, errors: ParsedListNotificationsQuery['errors']): boolean {
  if (v === undefined) return false
  if (v === 'true') return true
  if (v === 'false') return false
  errors.push({
    field: 'unreadOnly',
    code: 'invalid',
    message: 'unreadOnly must be true or false',
  })
  return false
}

function dateToIso(d: Date | undefined): string | null {
  return d ? d.toISOString() : null
}

export function toNotificationResponse(result: NotificationResult): NotificationResponse {
  const notification = result.notification
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    relatedInternshipId: notification.relatedInternshipId ?? null,
    relatedOpportunityId: notification.relatedOpportunityId ?? null,
    relatedTicketId: notification.relatedTicketId ?? null,
    emailDeliveryStatus: notification.emailDeliveryStatus ?? null,
    emailDeliveredAt: dateToIso(notification.emailDeliveredAt),
    readAt: dateToIso(notification.readAt),
    createdAt: notification.createdAt.toISOString(),
  }
}

export function toNotificationListResponse(
  result: NotificationListResultWithCursor
): NotificationListResponse {
  let nextPageToken: string | null = null
  if (result.cursor) {
    nextPageToken = encodePageToken({
      path: `notifications/${result.cursor.lastDocId}`,
      values: [result.cursor.lastValue.toISOString()],
      sort: `${result.cursor.sortField}:${result.cursor.sortDirection}`,
    })
  }

  return {
    items: result.items.map((notification) => toNotificationResponse({ notification })),
    nextPageToken,
    unreadCount: result.unreadCount,
  }
}

export function toMarkAllNotificationsReadResponse(
  markedReadCount: number
): MarkAllNotificationsReadResponse {
  return { markedReadCount }
}
