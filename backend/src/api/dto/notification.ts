import { z } from 'zod'
import {
  emailDeliveryStatusValues,
  notificationTypeValues,
} from '../../domain/value-objects/notification-enums'

export const notificationResponseSchema = z
  .object({
    id: z.string().meta({ example: 'nt_001' }),
    type: z.enum(notificationTypeValues),
    title: z.string().meta({ example: 'Offer approved' }),
    body: z.string().meta({ example: 'Your internship offer has been approved.' }),
    relatedInternshipId: z.string().nullable().meta({ example: 'int_001' }),
    relatedOpportunityId: z.string().nullable().meta({ example: 'opp_042' }),
    relatedTicketId: z.string().nullable().meta({ example: 'tkt_001' }),
    emailDeliveryStatus: z.enum(emailDeliveryStatusValues).nullable(),
    emailDeliveredAt: z.string().datetime().nullable(),
    readAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime().meta({ example: '2026-04-05T03:14:12Z' }),
  })
  .meta({
    id: 'NotificationResponse',
    description: 'User notification record.',
  })

export type NotificationResponse = z.infer<typeof notificationResponseSchema>

export const notificationListResponseSchema = z
  .object({
    items: z.array(notificationResponseSchema),
    nextPageToken: z.string().nullable(),
    unreadCount: z.number().int().nonnegative(),
  })
  .meta({
    id: 'NotificationListResponse',
    description: 'Paginated notifications plus total unread count for the caller.',
  })

export type NotificationListResponse = z.infer<typeof notificationListResponseSchema>

export const markAllNotificationsReadResponseSchema = z
  .object({
    markedReadCount: z.number().int().nonnegative(),
  })
  .meta({
    id: 'MarkAllNotificationsReadResponse',
    description: 'Result of bulk mark-all-notifications-read.',
  })

export type MarkAllNotificationsReadResponse = z.infer<
  typeof markAllNotificationsReadResponseSchema
>
