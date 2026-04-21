import { Router, type Router as ExpressRouter } from 'express'
import type { Request, Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth'
import { ApiError } from '../errors'
import { patchUserRequestSchema, FORBIDDEN_TOP_LEVEL_FIELDS } from '../schemas/user'
import { toUpdateUserProfileCommand, toUserResponse, etagFrom } from '../mappers/user'
import { GetUserQueryHandler } from '../../application/queries/get-user'
import { UpdateUserProfileCommandHandler } from '../../application/commands/update-user-profile'
import type { UnitOfWork } from '../../application/ports/unit-of-work'

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
  const updateUserProfile = new UpdateUserProfileCommandHandler(deps.uow)

  // ---------- GET ----------
  router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const userId = actor.platformUser?.id
      if (!userId) {
        next(
          new ApiError(
            401,
            'Unauthorized',
            'Cannot resolve `me`: caller has no platform user record. Call POST /api/v1/auth/sync first.',
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

  // ---------- PATCH ----------
  router.patch('/me', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const userId = actor.platformUser?.id
      if (!userId) {
        next(
          new ApiError(
            401,
            'Unauthorized',
            'Cannot resolve `me`: caller has no platform user record. Call POST /api/v1/auth/sync first.',
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

  return router
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
