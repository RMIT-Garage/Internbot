import { Router, type Router as ExpressRouter } from 'express'
import type { Request, Response, NextFunction } from 'express'
import type { ZodError } from 'zod'
import type { AuthenticatedRequest } from '../middleware/auth'
import { ApiError } from '../errors'
import {
  createTicketRequestSchema,
  postTicketReplyRequestSchema,
  transitionTicketRequestSchema,
  FORBIDDEN_CREATE_TICKET_FIELDS,
} from '../schemas/ticket'
import {
  etagFromTicket,
  parseListTicketsQuery,
  toCreateTicketCommand,
  toPostTicketReplyCommand,
  toTicketListResponse,
  toTicketReplyResponse,
  toTicketResponse,
  toTransitionTicketCommand,
} from '../mappers/ticket'
import { CreateTicketCommandHandler } from '../../application/commands/create-ticket'
import { PostTicketReplyCommandHandler } from '../../application/commands/post-ticket-reply'
import { TransitionTicketCommandHandler } from '../../application/commands/transition-ticket'
import { GetTicketQueryHandler } from '../../application/queries/get-ticket'
import { ListTicketsQueryHandler } from '../../application/queries/list-tickets'
import type { UnitOfWork } from '../../application/ports/unit-of-work'
import type { IdGenerator } from '../../application/ports/id-generator'
import { clampLimit } from '../utils/pagination'

export interface TicketsRouterDeps {
  uow: UnitOfWork
  idGenerator: IdGenerator
}

export function createTicketsRouter(deps: TicketsRouterDeps): ExpressRouter {
  const router: ExpressRouter = Router()
  const createTicket = new CreateTicketCommandHandler(deps.uow, deps.idGenerator)
  const postReply = new PostTicketReplyCommandHandler(deps.uow, deps.idGenerator)
  const transitionTicket = new TransitionTicketCommandHandler(deps.uow, deps.idGenerator)
  const getTicket = new GetTicketQueryHandler(deps.uow)
  const listTickets = new ListTicketsQueryHandler(deps.uow)

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const limit = clampLimit(req.query['limit'])
      const parsed = parseListTicketsQuery(req.query as Record<string, unknown>, limit)
      if (parsed.errors.length > 0) {
        next(
          new ApiError(400, 'Bad Request', parsed.errors[0]!.message, {
            reason: 'invalid_query',
            fields: parsed.errors,
          })
        )
        return
      }

      const result = await listTickets.handle({ actor, filter: parsed.query })
      res.setHeader('Cache-Control', 'private, no-cache')
      res.status(200).json(toTicketListResponse(result))
    } catch (err) {
      next(err)
    }
  })

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const result = await getTicket.handle({ actor, ticketId: paramId(req) })
      res.setHeader('ETag', etagFromTicket(result))
      res.setHeader('Cache-Control', 'private, no-cache')
      res.status(200).json(toTicketResponse(result))
    } catch (err) {
      next(err)
    }
  })

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawBody = (req.body ?? {}) as Record<string, unknown>
      const forbidden = forbiddenFields(rawBody, FORBIDDEN_CREATE_TICKET_FIELDS)
      if (forbidden.length > 0) {
        next(immutableFieldsError(forbidden, 'POST /tickets'))
        return
      }

      const parsed = createTicketRequestSchema.safeParse(rawBody)
      if (!parsed.success) {
        next(zodBodyError(parsed.error))
        return
      }

      const { actor } = req as AuthenticatedRequest
      const { id } = await createTicket.handle(toCreateTicketCommand(actor, parsed.data))
      const result = await getTicket.handle({ actor, ticketId: id })

      res.setHeader('Location', `/api/v1/tickets/${id}`)
      res.setHeader('ETag', etagFromTicket(result))
      res.setHeader('Cache-Control', 'private, no-cache')
      res.status(201).json(toTicketResponse(result))
    } catch (err) {
      next(err)
    }
  })

  router.post('/:id/replies', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticketId = paramId(req)
      const parsed = postTicketReplyRequestSchema.safeParse(req.body)
      if (!parsed.success) {
        next(zodBodyError(parsed.error))
        return
      }

      const { actor } = req as AuthenticatedRequest
      const result = await postReply.handle(toPostTicketReplyCommand(actor, ticketId, parsed.data))

      res.setHeader('Location', `/api/v1/tickets/${ticketId}/replies/${result.reply.id}`)
      res.status(201).json(toTicketReplyResponse(result))
    } catch (err) {
      next(err)
    }
  })

  router.post('/:id/transitions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticketId = paramId(req)
      const parsed = transitionTicketRequestSchema.safeParse(req.body)
      if (!parsed.success) {
        next(zodBodyError(parsed.error))
        return
      }

      const { actor } = req as AuthenticatedRequest
      const { id } = await transitionTicket.handle(
        toTransitionTicketCommand(actor, ticketId, req.header('If-Match'), parsed.data)
      )
      const result = await getTicket.handle({ actor, ticketId: id })

      res.setHeader('Location', `/api/v1/tickets/${id}`)
      res.setHeader('ETag', etagFromTicket(result))
      res.setHeader('Cache-Control', 'private, no-cache')
      res.status(201).json(toTicketResponse(result))
    } catch (err) {
      next(err)
    }
  })

  return router
}

function paramId(req: Request): string {
  const raw = req.params['id']
  return Array.isArray(raw) ? raw[0]! : raw!
}

function forbiddenFields(
  rawBody: Record<string, unknown>,
  forbidden: ReadonlySet<string>
): string[] {
  return Object.keys(rawBody).filter((k) => forbidden.has(k))
}

function immutableFieldsError(fields: readonly string[], route: string): ApiError {
  return new ApiError(400, 'Bad Request', 'Body contains non-writable fields', {
    reason: 'immutable_field',
    fields: fields.map((field) => ({
      field,
      code: 'immutable',
      message: `${field} is not writable through ${route}`,
    })),
  })
}

function zodBodyError(error: ZodError): ApiError {
  const issue = error.issues[0]
  const issuePath = issue?.path.join('.')
  const isMissing = issue?.code === 'invalid_type' && /received undefined/.test(issue.message ?? '')
  const isEmptyText =
    issue?.code === 'too_small' &&
    (issuePath === 'subject' || issuePath === 'body' || issuePath === 'text')
  const status = isMissing || isEmptyText ? 422 : 400
  const reason = isMissing
    ? 'missing_required_field'
    : isEmptyText
      ? 'missing_required_field'
      : 'invalid_body'
  return new ApiError(
    status,
    status === 422 ? 'Unprocessable Entity' : 'Bad Request',
    issue?.message ?? 'Invalid body',
    {
      reason,
      fields: error.issues.map((i) => ({
        field: i.path.join('.'),
        code: i.code,
        message: i.message,
      })),
    }
  )
}
