import { z } from 'zod'

export const markNotificationReadRequestSchema = z
  .object({
    read: z.literal(true).meta({
      description: 'Must be true. Resetting notifications to unread is not supported in v1.',
    }),
  })
  .strict()
  .meta({
    id: 'MarkNotificationReadRequest',
    description: 'Body for PATCH /api/v1/notifications/:id.',
  })

export type MarkNotificationReadRequest = z.infer<typeof markNotificationReadRequestSchema>

export const markAllNotificationsReadRequestSchema = markNotificationReadRequestSchema.meta({
  id: 'MarkAllNotificationsReadRequest',
  description: 'Body for PUT /api/v1/notifications.',
})

export type MarkAllNotificationsReadRequest = z.infer<typeof markAllNotificationsReadRequestSchema>
