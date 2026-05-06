import { z } from 'zod'
import { ticketStatusValues } from '../../domain/value-objects/ticket-enums'

const nonEmptyText = z.string().trim().min(1)

export const createTicketRequestSchema = z
  .object({
    subject: nonEmptyText.meta({ example: 'Question about study load requirement' }),
    body: nonEmptyText.meta({ example: 'I am currently part-time…' }),
    category: nonEmptyText.optional().meta({ example: 'eligibility' }),
  })
  .strict()
  .meta({
    id: 'CreateTicketRequest',
    description: 'Body for POST /api/v1/tickets. See WORKFLOW-API-SPEC.md §7.10.',
  })

export type CreateTicketRequest = z.infer<typeof createTicketRequestSchema>

export const postTicketReplyRequestSchema = z
  .object({
    text: nonEmptyText,
  })
  .strict()
  .meta({
    id: 'PostTicketReplyRequest',
    description: 'Body for POST /api/v1/tickets/:id/replies.',
  })

export type PostTicketReplyRequest = z.infer<typeof postTicketReplyRequestSchema>

export const transitionTicketRequestSchema = z
  .object({
    to: z.enum(ticketStatusValues),
    comment: nonEmptyText.optional(),
  })
  .strict()
  .meta({
    id: 'TransitionTicketRequest',
    description: 'Body for POST /api/v1/tickets/:id/transitions.',
  })

export type TransitionTicketRequest = z.infer<typeof transitionTicketRequestSchema>

export const FORBIDDEN_CREATE_TICKET_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'userId',
  'status',
  'version',
  'createdAt',
  'updatedAt',
  '_schemaVersion',
])
