import type { ZodOpenApiOperationObject } from 'zod-openapi'
import { z } from 'zod'
import {
  markAllNotificationsReadRequestSchema,
  markNotificationReadRequestSchema,
} from '../../schemas/notification'
import {
  markAllNotificationsReadResponseSchema,
  notificationListResponseSchema,
  notificationResponseSchema,
} from '../../dto/notification'
import { errorResponseSchema } from '../common'

const notificationIdPathParams = z.object({
  id: z.string().meta({ example: 'nt_001', description: 'Platform notification id.' }),
})

const listNotificationsQuerySchema = z.object({
  unreadOnly: z
    .enum(['true', 'false'])
    .optional()
    .meta({ description: 'When true, return only unread notifications.' }),
  limit: z.number().int().min(1).max(200).optional(),
  pageToken: z.string().optional(),
})

export const listNotificationsOperation: ZodOpenApiOperationObject = {
  operationId: 'listNotifications',
  summary: "List the caller's notifications",
  description:
    'Returns only notifications owned by the authenticated platform user, newest first. `unreadCount` is total unread across all pages. See WORKFLOW-API-SPEC.md §7.8.',
  tags: ['Notifications'],
  security: [{ bearerAuth: [] }],
  requestParams: { query: listNotificationsQuerySchema },
  responses: {
    '200': {
      description: 'Paginated list of notifications.',
      content: { 'application/json': { schema: notificationListResponseSchema } },
    },
    '400': {
      description: 'Malformed query string or page token.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '401': {
      description: 'Missing or invalid Firebase ID token.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}

export const markNotificationReadOperation: ZodOpenApiOperationObject = {
  operationId: 'markNotificationRead',
  summary: 'Mark a notification as read',
  description:
    'Owner-only. The only supported mutation is `read: true`; resetting to unread is not supported in v1. See WORKFLOW-API-SPEC.md §7.8.',
  tags: ['Notifications'],
  security: [{ bearerAuth: [] }],
  requestParams: { path: notificationIdPathParams },
  requestBody: {
    required: true,
    content: { 'application/json': { schema: markNotificationReadRequestSchema } },
  },
  responses: {
    '200': {
      description: 'Notification marked read, or already read.',
      content: { 'application/json': { schema: notificationResponseSchema } },
    },
    '400': {
      description: 'Body contains unsupported fields or `read` is not true.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '401': {
      description: 'Missing or invalid Firebase ID token.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '403': {
      description: 'Caller is not the notification owner.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '404': {
      description: 'Notification does not exist.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}

export const markAllNotificationsReadOperation: ZodOpenApiOperationObject = {
  operationId: 'markAllNotificationsRead',
  summary: 'Mark all caller notifications as read',
  description:
    "Scopes the bulk operation to the authenticated platform user's unread notifications. See WORKFLOW-API-SPEC.md §7.8.",
  tags: ['Notifications'],
  security: [{ bearerAuth: [] }],
  requestBody: {
    required: true,
    content: { 'application/json': { schema: markAllNotificationsReadRequestSchema } },
  },
  responses: {
    '200': {
      description: 'Bulk mark-read completed.',
      content: { 'application/json': { schema: markAllNotificationsReadResponseSchema } },
    },
    '400': {
      description: 'Body contains unsupported fields or `read` is not true.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '401': {
      description: 'Missing or invalid Firebase ID token.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}
