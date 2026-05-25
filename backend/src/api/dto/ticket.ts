import { z } from 'zod'
import { ticketStatusValues } from '../../domain/value-objects/ticket-enums'
import { roleValues } from '../../domain/value-objects/user-enums'

export const ticketReplyResponseSchema = z
  .object({
    id: z.string().meta({ example: 'rep_001' }),
    authorUserId: z.string().meta({ example: 'usr_DeF456UvW' }),
    authorRole: z.enum(roleValues),
    text: z.string().meta({ example: 'Yes, you can apply now.' }),
    createdAt: z.string().datetime().meta({ example: '2026-04-05T04:00:00Z' }),
  })
  .meta({
    id: 'TicketReplyResponse',
    description: 'Reply on a ticket conversation thread.',
  })

export type TicketReplyResponse = z.infer<typeof ticketReplyResponseSchema>

export const ticketResponseSchema = z
  .object({
    id: z.string().meta({ example: 'tkt_001' }),
    userId: z.string().meta({ example: 'usr_aBc123XyZ' }),
    subject: z.string().meta({ example: 'Question about study load requirement' }),
    body: z.string().meta({
      example: "I'm currently part-time but planning to switch to full-time next semester.",
    }),
    category: z.string().nullable().meta({ example: 'eligibility' }),
    status: z.enum(ticketStatusValues),
    version: z.number().int().nonnegative(),
    replies: z.array(ticketReplyResponseSchema),
    createdAt: z.string().datetime().meta({ example: '2026-04-05T03:14:12Z' }),
    updatedAt: z.string().datetime().meta({ example: '2026-04-05T03:14:12Z' }),
  })
  .meta({
    id: 'TicketResponse',
    description: 'Support ticket record (see WORKFLOW-API-SPEC.md §7.10 / §8.7).',
  })

export type TicketResponse = z.infer<typeof ticketResponseSchema>

export const ticketListItemResponseSchema = ticketResponseSchema
  .omit({ body: true, version: true, replies: true })
  .meta({
    id: 'TicketListItemResponse',
    description: 'Support ticket list item — body and replies are omitted from list responses.',
  })

export type TicketListItemResponse = z.infer<typeof ticketListItemResponseSchema>

export const ticketListResponseSchema = z
  .object({
    items: z.array(ticketListItemResponseSchema),
    nextPageToken: z.string().nullable(),
  })
  .meta({
    id: 'TicketListResponse',
    description: 'Paginated list of tickets.',
  })

export type TicketListResponse = z.infer<typeof ticketListResponseSchema>
