import type { ZodOpenApiOperationObject } from 'zod-openapi'
import { z } from 'zod'
import {
  createTicketRequestSchema,
  postTicketReplyRequestSchema,
  transitionTicketRequestSchema,
} from '../../schemas/ticket'
import {
  ticketListResponseSchema,
  ticketReplyResponseSchema,
  ticketResponseSchema,
} from '../../dto/ticket'
import { errorResponseSchema } from '../common'
import { ticketStatusValues } from '../../../domain/value-objects/ticket-enums'

const ticketIdPathParams = z.object({
  id: z.string().meta({ example: 'tkt_001', description: 'Platform ticket id.' }),
})

const ifMatchHeaderSchema = z.object({
  'if-match': z.string().optional().meta({
    description: 'Opt-in optimistic concurrency — the current ETag from a prior GET.',
  }),
})

const listTicketsQuerySchema = z.object({
  status: z.enum(ticketStatusValues).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  pageToken: z.string().optional(),
  sort: z
    .enum(['createdAt', '-createdAt'])
    .optional()
    .meta({ description: 'Default `-createdAt`. Prefix with `-` for descending.' }),
})

export const listTicketsOperation: ZodOpenApiOperationObject = {
  operationId: 'listTickets',
  summary: 'List tickets visible to the caller',
  description:
    'Students are server-filtered to their own tickets; coordinators see all. See WORKFLOW-API-SPEC.md §7.10.',
  tags: ['Tickets'],
  security: [{ bearerAuth: [] }],
  requestParams: { query: listTicketsQuerySchema },
  responses: {
    '200': {
      description: 'Paginated list of tickets.',
      content: { 'application/json': { schema: ticketListResponseSchema } },
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

export const getTicketOperation: ZodOpenApiOperationObject = {
  operationId: 'getTicket',
  summary: 'Return a ticket by id',
  description: 'Ticket owner or coordinator.',
  tags: ['Tickets'],
  security: [{ bearerAuth: [] }],
  requestParams: { path: ticketIdPathParams },
  responses: {
    '200': {
      description: 'Ticket found.',
      headers: { ETag: { schema: { type: 'string' } } },
      content: { 'application/json': { schema: ticketResponseSchema } },
    },
    '403': {
      description: 'Student caller is not the ticket owner.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '404': {
      description: 'No ticket exists with the supplied id.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}

export const createTicketOperation: ZodOpenApiOperationObject = {
  operationId: 'createTicket',
  summary: 'Open a support ticket',
  description: 'Student-only. Creates a ticket in `open` state and notifies coordinators.',
  tags: ['Tickets'],
  security: [{ bearerAuth: [] }],
  requestBody: {
    required: true,
    content: { 'application/json': { schema: createTicketRequestSchema } },
  },
  responses: {
    '201': {
      description: 'Ticket created.',
      headers: {
        Location: { schema: { type: 'string' } },
        ETag: { schema: { type: 'string' } },
      },
      content: { 'application/json': { schema: ticketResponseSchema } },
    },
    '400': {
      description: 'Body contains immutable or unknown fields.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '403': {
      description: 'Caller is not a student.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '422': {
      description: 'Missing subject or body.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}

export const postTicketReplyOperation: ZodOpenApiOperationObject = {
  operationId: 'postTicketReply',
  summary: 'Append a reply to a ticket',
  description:
    'Ticket owner or coordinator. Bumps `updatedAt` but does not rotate the ticket ETag. Notifies the counterparty.',
  tags: ['Tickets'],
  security: [{ bearerAuth: [] }],
  requestParams: { path: ticketIdPathParams },
  requestBody: {
    required: true,
    content: { 'application/json': { schema: postTicketReplyRequestSchema } },
  },
  responses: {
    '201': {
      description: 'Reply created.',
      headers: { Location: { schema: { type: 'string' } } },
      content: { 'application/json': { schema: ticketReplyResponseSchema } },
    },
    '403': {
      description: 'Student caller is not the ticket owner.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '404': {
      description: 'No ticket exists with the supplied id.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '422': {
      description: 'Missing or empty text.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}

export const transitionTicketOperation: ZodOpenApiOperationObject = {
  operationId: 'transitionTicket',
  summary: 'Move a ticket through its support-workflow lifecycle',
  description:
    'Allowed (from, to) pairs and per-pair role rules per WORKFLOW-API-SPEC.md §7.10. Activity recorded under `tickets/{id}/activity`.',
  tags: ['Tickets'],
  security: [{ bearerAuth: [] }],
  requestParams: { path: ticketIdPathParams, header: ifMatchHeaderSchema },
  requestBody: {
    required: true,
    content: { 'application/json': { schema: transitionTicketRequestSchema } },
  },
  responses: {
    '201': {
      description: 'Transition applied.',
      headers: {
        Location: { schema: { type: 'string' } },
        ETag: { schema: { type: 'string' } },
      },
      content: { 'application/json': { schema: ticketResponseSchema } },
    },
    '400': {
      description: '`to` is missing or not one of the allowed status values.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '403': {
      description:
        'Caller does not own the ticket, or the role is not permitted to perform this transition.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '404': {
      description: 'No ticket exists with the supplied id.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '409': {
      description: 'Current status plus requested `to` is not a permitted transition.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '412': {
      description: 'Stale `If-Match`.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}
