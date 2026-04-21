import { Router, type Router as ExpressRouter } from 'express'
import type { Request, Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth'
import { ApiError } from '../errors'
import { patchUserRequestSchema, FORBIDDEN_TOP_LEVEL_FIELDS } from '../schemas/user'
import { toUpdateUserProfileCommand, toUserResponse, etagFrom } from '../mappers/user'
import { resolveUserId } from '../utils/resolve-user-id'
import { GetUserQueryHandler } from '../../application/queries/get-user'
import { UpdateUserProfileCommandHandler } from '../../application/commands/update-user-profile'
import type { UnitOfWork } from '../../application/ports/unit-of-work'

export interface UsersRouterDeps {
  uow: UnitOfWork
}

export function createUsersRouter(deps: UsersRouterDeps): ExpressRouter {
  const router: ExpressRouter = Router()
  const getUser = new GetUserQueryHandler(deps.uow)
  const updateUserProfile = new UpdateUserProfileCommandHandler(deps.uow)

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const rawId = req.params['id']
      const idString = Array.isArray(rawId) ? rawId[0]! : rawId!
      const userId = resolveUserId(idString, actor)
      const result = await getUser.handle({ actor, userId })
      res.setHeader('ETag', etagFrom(result))
      res.setHeader('Cache-Control', 'private, no-cache')
      res.status(200).json(toUserResponse(result))
    } catch (err) {
      next(err)
    }
  })

  router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest

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

      const rawId = req.params['id']
      const idString = Array.isArray(rawId) ? rawId[0]! : rawId!
      const userId = resolveUserId(idString, actor)
      const ifMatch = req.header('If-Match')
      const cmd = toUpdateUserProfileCommand(actor, userId, ifMatch, parsed.data)
      const { id } = await updateUserProfile.handle(cmd)

      const result = await getUser.handle({ actor, userId: id })
      res.setHeader('ETag', etagFrom(result))
      res.setHeader('Cache-Control', 'private, no-cache')
      res.status(200).json(toUserResponse(result))
    } catch (err) {
      next(err)
    }
  })

  return router
}
