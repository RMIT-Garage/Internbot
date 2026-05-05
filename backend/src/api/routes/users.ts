import { Router, type Router as ExpressRouter } from 'express'
import type { Request, Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth'
import { ApiError } from '../errors'
import {
  patchUserRequestSchema,
  putSemesterSelectionRequestSchema,
  FORBIDDEN_TOP_LEVEL_FIELDS,
} from '../schemas/user'
import {
  toUpdateUserProfileCommand,
  toSelectSemesterCommand,
  toUserResponse,
  toUserActivityFeedResponse,
  toUserWorkflowResponse,
  parseListUserActivityQuery,
  etagFrom,
} from '../mappers/user'
import { GetUserQueryHandler } from '../../application/queries/get-user'
import { GetUserWorkflowQueryHandler } from '../../application/queries/get-user-workflow'
import { ListUserActivityQueryHandler } from '../../application/queries/list-user-activity'
import { UpdateUserProfileCommandHandler } from '../../application/commands/update-user-profile'
import { SelectSemesterCommandHandler } from '../../application/commands/select-semester'
import type { UnitOfWork } from '../../application/ports/unit-of-work'
import { clampLimit } from '../utils/pagination'

export interface UsersRouterDeps {
  uow: UnitOfWork
}

/**
 * Route order matters: `/me` is declared BEFORE `/:id` so the literal
 * path segment matches as a distinct operation. The handlers resolve the
 * caller's id directly from the authenticated actor — no magic-string
 * alias trick in the `:id` param. Bare `/users/:id` handlers take the id
 * verbatim from the URL.
 *
 * Callers who hit `/me` before syncing to the platform get a clean 401
 * with `reason: no_platform_user` — `me` cannot be resolved without a
 * platform identity. Other authz (role / ownership) still runs inside
 * the CQRS handler.
 */
export function createUsersRouter(deps: UsersRouterDeps): ExpressRouter {
  const router: ExpressRouter = Router()
  const getUser = new GetUserQueryHandler(deps.uow)
  const getUserWorkflow = new GetUserWorkflowQueryHandler(deps.uow)
  const listUserActivity = new ListUserActivityQueryHandler(deps.uow)
  const updateUserProfile = new UpdateUserProfileCommandHandler(deps.uow)
  const selectSemester = new SelectSemesterCommandHandler(deps.uow)

  // ---------- GET ----------
  router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const userId = actor.platformUser?.id
      if (!userId) {
        next(
          new ApiError(
            403,
            'Forbidden',
            'Cannot resolve `me`: caller has no platform user record.',
            { reason: 'no_platform_user' }
          )
        )
        return
      }
      const result = await getUser.handle({ actor, userId })
      res.setHeader('ETag', etagFrom(result))
      res.setHeader('Cache-Control', 'private, no-cache')
      res.status(200).json(toUserResponse(result))
    } catch (err) {
      next(err)
    }
  })

  router.get('/me/activity', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const userId = actor.platformUser?.id
      if (!userId) {
        next(unsyncedError())
        return
      }
      await handleGetActivity(req, res, next, userId, listUserActivity, actor)
    } catch (err) {
      next(err)
    }
  })

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const rawId = req.params['id']
      const userId = Array.isArray(rawId) ? rawId[0]! : rawId!
      const result = await getUser.handle({ actor, userId })
      res.setHeader('ETag', etagFrom(result))
      res.setHeader('Cache-Control', 'private, no-cache')
      res.status(200).json(toUserResponse(result))
    } catch (err) {
      next(err)
    }
  })

  router.get('/:id/activity', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      await handleGetActivity(req, res, next, paramId(req), listUserActivity, actor)
    } catch (err) {
      next(err)
    }
  })

  // ---------- PATCH ----------
  router.patch('/me', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const userId = actor.platformUser?.id
      if (!userId) {
        next(
          new ApiError(
            403,
            'Forbidden',
            'Cannot resolve `me`: caller has no platform user record.',
            { reason: 'no_platform_user' }
          )
        )
        return
      }
      await handlePatch(req, res, next, userId, updateUserProfile, getUser, actor)
    } catch (err) {
      next(err)
    }
  })

  router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const rawId = req.params['id']
      const userId = Array.isArray(rawId) ? rawId[0]! : rawId!
      await handlePatch(req, res, next, userId, updateUserProfile, getUser, actor)
    } catch (err) {
      next(err)
    }
  })

  // ---------- WORKFLOW (GET) ----------
  router.get('/me/workflow', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const userId = actor.platformUser?.id
      if (!userId) {
        next(unsyncedError())
        return
      }
      const result = await getUserWorkflow.handle({ actor, userId })
      res.setHeader('Cache-Control', 'private, no-cache')
      res.status(200).json(toUserWorkflowResponse(result))
    } catch (err) {
      next(err)
    }
  })

  router.get('/:id/workflow', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const userId = paramId(req)
      const result = await getUserWorkflow.handle({ actor, userId })
      res.setHeader('Cache-Control', 'private, no-cache')
      res.status(200).json(toUserWorkflowResponse(result))
    } catch (err) {
      next(err)
    }
  })

  // ---------- SEMESTER SELECTION (PUT) ----------
  router.put('/me/semester-selection', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const userId = actor.platformUser?.id
      if (!userId) {
        next(unsyncedError())
        return
      }
      await handlePutSemesterSelection(req, res, next, userId, selectSemester, getUser, actor)
    } catch (err) {
      next(err)
    }
  })

  router.put('/:id/semester-selection', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const userId = paramId(req)
      await handlePutSemesterSelection(req, res, next, userId, selectSemester, getUser, actor)
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

function unsyncedError(): ApiError {
  return new ApiError(
    403,
    'Forbidden',
    'Cannot resolve `me`: caller has no platform user record.',
    { reason: 'no_platform_user' }
  )
}

async function handleGetActivity(
  req: Request,
  res: Response,
  next: NextFunction,
  userId: string,
  listUserActivity: ListUserActivityQueryHandler,
  actor: AuthenticatedRequest['actor']
): Promise<void> {
  const limit = clampLimit(req.query['limit'])
  const parsed = parseListUserActivityQuery(req.query as Record<string, unknown>, limit)
  if (parsed.errors.length > 0) {
    next(
      new ApiError(400, 'Bad Request', parsed.errors[0]!.message, {
        reason: 'invalid_query',
        fields: parsed.errors,
      })
    )
    return
  }

  const result = await listUserActivity.handle({ actor, userId, filter: parsed.query })
  res.setHeader('Cache-Control', 'private, no-cache')
  res.status(200).json(toUserActivityFeedResponse(result))
}

/**
 * PUT /:id/semester-selection (and /me alias) body validation + dispatch.
 *
 * Spec §7.6: malformed / missing `semesterId` returns 422
 * `missing_required_field`. Zod v4 reports both missing-required and
 * wrong-type as `invalid_type`; we re-use the same heuristic the semester
 * routes use ("received undefined" message text → 422; everything else →
 * 400) to stay consistent with the rest of the surface.
 */
async function handlePutSemesterSelection(
  req: Request,
  res: Response,
  next: NextFunction,
  userId: string,
  selectSemester: SelectSemesterCommandHandler,
  getUser: GetUserQueryHandler,
  actor: AuthenticatedRequest['actor']
): Promise<void> {
  const parsed = putSemesterSelectionRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const isMissing =
      issue?.code === 'invalid_type' && /received undefined/.test(issue.message ?? '')
    const status = isMissing ? 422 : 400
    const reason = isMissing ? 'missing_required_field' : 'invalid_body'
    next(
      new ApiError(
        status,
        status === 422 ? 'Unprocessable Entity' : 'Bad Request',
        issue?.message ?? 'Invalid body',
        {
          reason,
          fields: parsed.error.issues.map((i) => ({
            field: i.path.join('.'),
            code: i.code,
            message: i.message,
          })),
        }
      )
    )
    return
  }

  const ifMatch = req.header('If-Match')
  const cmd = toSelectSemesterCommand(actor, userId, ifMatch, parsed.data)
  const { id } = await selectSemester.handle(cmd)
  const result = await getUser.handle({ actor, userId: id })

  res.setHeader('ETag', etagFrom(result))
  res.setHeader('Cache-Control', 'private, no-cache')
  res.status(200).json(toUserResponse(result))
}

/**
 * PATCH body validation + dispatch shared between `/me` and `/:id`.
 * Kept as a private helper (not exported) because the only difference
 * between the two routes is how `userId` is resolved — everything after
 * that is identical.
 */
async function handlePatch(
  req: Request,
  res: Response,
  next: NextFunction,
  userId: string,
  updateUserProfile: UpdateUserProfileCommandHandler,
  getUser: GetUserQueryHandler,
  actor: AuthenticatedRequest['actor']
): Promise<void> {
  const rawBody = (req.body ?? {}) as Record<string, unknown>
  const forbidden = Object.keys(rawBody).filter((k) => FORBIDDEN_TOP_LEVEL_FIELDS.has(k))
  if (forbidden.length > 0) {
    next(
      new ApiError(400, 'Bad Request', 'Body contains non-writable fields', {
        reason: 'immutable_field',
        fields: forbidden.map((field) => ({
          field,
          code: 'immutable',
          message: `${field} is not writable through PATCH /users/:id`,
        })),
      })
    )
    return
  }

  const parsed = patchUserRequestSchema.safeParse(rawBody)
  if (!parsed.success) {
    next(
      new ApiError(400, 'Bad Request', parsed.error.issues[0]?.message ?? 'Invalid body', {
        reason: 'invalid_body',
        fields: parsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          code: i.code,
          message: i.message,
        })),
      })
    )
    return
  }

  if (Object.keys(parsed.data.studentProfile).length === 0) {
    next(
      new ApiError(422, 'Unprocessable Entity', 'Request body is empty', {
        reason: 'empty_body',
      })
    )
    return
  }

  const ifMatch = req.header('If-Match')
  const cmd = toUpdateUserProfileCommand(actor, userId, ifMatch, parsed.data)
  const { id } = await updateUserProfile.handle(cmd)

  const result = await getUser.handle({ actor, userId: id })
  res.setHeader('ETag', etagFrom(result))
  res.setHeader('Cache-Control', 'private, no-cache')
  res.status(200).json(toUserResponse(result))
}
