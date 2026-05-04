import { Router, type Router as ExpressRouter } from 'express'
import type { Request, Response, NextFunction } from 'express'
import type { ZodError } from 'zod'
import type { AuthenticatedRequest } from '../middleware/auth'
import { ApiError } from '../errors'
import {
  createOpportunityRequestSchema,
  patchOpportunityRequestSchema,
  transitionOpportunityRequestSchema,
  verifyOpportunityRequestSchema,
  FORBIDDEN_CREATE_OPPORTUNITY_FIELDS,
  FORBIDDEN_PATCH_OPPORTUNITY_FIELDS,
} from '../schemas/opportunity'
import {
  etagFromOpportunity,
  parseListOpportunitiesQuery,
  toCreateOpportunityCommand,
  toOpportunityListResponse,
  toOpportunityResponse,
  toTransitionOpportunityCommand,
  toUpdateOpportunityCommand,
  toVerifyOpportunityCommand,
} from '../mappers/opportunity'
import { CreateOpportunityCommandHandler } from '../../application/commands/create-opportunity'
import { UpdateOpportunityCommandHandler } from '../../application/commands/update-opportunity'
import { TransitionOpportunityCommandHandler } from '../../application/commands/transition-opportunity'
import { VerifyOpportunityCommandHandler } from '../../application/commands/verify-opportunity'
import { GetOpportunityQueryHandler } from '../../application/queries/get-opportunity'
import { ListOpportunitiesQueryHandler } from '../../application/queries/list-opportunities'
import type { UnitOfWork } from '../../application/ports/unit-of-work'
import type { IdGenerator } from '../../application/ports/id-generator'
import { clampLimit } from '../utils/pagination'

export interface OpportunitiesRouterDeps {
  uow: UnitOfWork
  idGenerator: IdGenerator
}

export function createOpportunitiesRouter(deps: OpportunitiesRouterDeps): ExpressRouter {
  const router: ExpressRouter = Router()
  const createOpportunity = new CreateOpportunityCommandHandler(deps.uow, deps.idGenerator)
  const updateOpportunity = new UpdateOpportunityCommandHandler(deps.uow)
  const transitionOpportunity = new TransitionOpportunityCommandHandler(deps.uow)
  const verifyOpportunity = new VerifyOpportunityCommandHandler(deps.uow, deps.idGenerator)
  const getOpportunity = new GetOpportunityQueryHandler(deps.uow)
  const listOpportunities = new ListOpportunitiesQueryHandler(deps.uow)

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const limit = clampLimit(req.query['limit'])
      const parsed = parseListOpportunitiesQuery(req.query as Record<string, unknown>, limit)
      if (parsed.errors.length > 0) {
        next(
          new ApiError(400, 'Bad Request', parsed.errors[0]!.message, {
            reason: 'invalid_query',
            fields: parsed.errors,
          })
        )
        return
      }

      const result = await listOpportunities.handle({ actor, filter: parsed.query })
      res.status(200).json(toOpportunityListResponse(result))
    } catch (err) {
      next(err)
    }
  })

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const result = await getOpportunity.handle({ actor, opportunityId: paramId(req) })
      res.setHeader('ETag', etagFromOpportunity(result))
      res.setHeader('Cache-Control', 'private, no-cache')
      res.status(200).json(toOpportunityResponse(result))
    } catch (err) {
      next(err)
    }
  })

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawBody = (req.body ?? {}) as Record<string, unknown>
      const forbidden = forbiddenFields(rawBody, FORBIDDEN_CREATE_OPPORTUNITY_FIELDS)
      if (forbidden.length > 0) {
        next(immutableFieldsError(forbidden, 'POST /opportunities'))
        return
      }

      const parsed = createOpportunityRequestSchema.safeParse(rawBody)
      if (!parsed.success) {
        next(zodBodyError(parsed.error))
        return
      }

      const { actor } = req as AuthenticatedRequest
      const { id } = await createOpportunity.handle(toCreateOpportunityCommand(actor, parsed.data))
      const result = await getOpportunity.handle({ actor, opportunityId: id })

      res.setHeader('Location', `/api/v1/opportunities/${id}`)
      res.setHeader('ETag', etagFromOpportunity(result))
      res.setHeader('Cache-Control', 'private, no-cache')
      res.status(201).json(toOpportunityResponse(result))
    } catch (err) {
      next(err)
    }
  })

  router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const opportunityId = paramId(req)
      const rawBody = (req.body ?? {}) as Record<string, unknown>
      const forbidden = forbiddenFields(rawBody, FORBIDDEN_PATCH_OPPORTUNITY_FIELDS)
      if (forbidden.length > 0) {
        next(immutableFieldsError(forbidden, 'PATCH /opportunities/:id'))
        return
      }

      const parsed = patchOpportunityRequestSchema.safeParse(rawBody)
      if (!parsed.success) {
        next(zodBodyError(parsed.error, false))
        return
      }
      if (Object.keys(parsed.data).length === 0) {
        next(
          new ApiError(422, 'Unprocessable Entity', 'Request body is empty', {
            reason: 'empty_body',
          })
        )
        return
      }

      const { id } = await updateOpportunity.handle(
        toUpdateOpportunityCommand(actor, opportunityId, req.header('If-Match'), parsed.data)
      )
      const result = await getOpportunity.handle({ actor, opportunityId: id })

      res.setHeader('ETag', etagFromOpportunity(result))
      res.setHeader('Cache-Control', 'private, no-cache')
      res.status(200).json(toOpportunityResponse(result))
    } catch (err) {
      next(err)
    }
  })

  router.post('/:id/transitions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const opportunityId = paramId(req)
      const parsed = transitionOpportunityRequestSchema.safeParse(req.body)
      if (!parsed.success) {
        next(zodBodyError(parsed.error, false))
        return
      }

      const { id } = await transitionOpportunity.handle(
        toTransitionOpportunityCommand(actor, opportunityId, req.header('If-Match'), parsed.data)
      )
      const result = await getOpportunity.handle({ actor, opportunityId: id })

      res.setHeader('Location', `/api/v1/opportunities/${id}`)
      res.setHeader('ETag', etagFromOpportunity(result))
      res.setHeader('Cache-Control', 'private, no-cache')
      res.status(201).json(toOpportunityResponse(result))
    } catch (err) {
      next(err)
    }
  })

  router.post('/:id/verifications', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const opportunityId = paramId(req)
      const parsed = verifyOpportunityRequestSchema.safeParse(req.body)
      if (!parsed.success) {
        next(zodBodyError(parsed.error, false))
        return
      }

      const { id } = await verifyOpportunity.handle(
        toVerifyOpportunityCommand(actor, opportunityId, req.header('If-Match'), parsed.data)
      )
      const result = await getOpportunity.handle({ actor, opportunityId: id })

      res.setHeader('Location', `/api/v1/opportunities/${id}`)
      res.setHeader('ETag', etagFromOpportunity(result))
      res.setHeader('Cache-Control', 'private, no-cache')
      res.status(201).json(toOpportunityResponse(result))
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

function zodBodyError(error: ZodError, detectMissing = true): ApiError {
  const issue = error.issues[0]
  const isMissing =
    detectMissing &&
    issue?.code === 'invalid_type' &&
    /received undefined/.test(issue.message ?? '')
  const status = isMissing ? 422 : 400
  const reason = isMissing ? 'missing_required_field' : 'invalid_body'
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
