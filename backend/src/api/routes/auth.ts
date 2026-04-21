import { Router, type Router as ExpressRouter } from 'express'
import type { Request, Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth'
import { ApiError } from '../errors'
import { authSyncRequestSchema } from '../schemas/user'
import { toSyncUserCommand, toUserResponse, etagFrom } from '../mappers/user'
import { SyncUserCommandHandler } from '../../application/commands/sync-user'
import { GetUserQueryHandler } from '../../application/queries/get-user'
import type { UnitOfWork } from '../../application/ports/unit-of-work'
import type { PlatformClaimsService } from '../../application/ports/platform-claims-service'

export interface AuthRouterDeps {
  uow: UnitOfWork
  platformClaimsService: PlatformClaimsService
}

export function createAuthRouter(deps: AuthRouterDeps): ExpressRouter {
  const router: ExpressRouter = Router()
  const syncUser = new SyncUserCommandHandler(deps.uow, deps.platformClaimsService)
  const getUser = new GetUserQueryHandler(deps.uow)

  router.post('/sync', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = authSyncRequestSchema.safeParse(req.body)
      if (!parsed.success) {
        next(
          new ApiError(400, 'Bad Request', parsed.error.issues[0]?.message ?? 'Invalid body', {
            reason: 'invalid_body',
          })
        )
        return
      }

      const { actor } = req as AuthenticatedRequest
      const cmd = toSyncUserCommand(actor, parsed.data)
      const { id, created } = await syncUser.handle(cmd)

      // Strict CQRS: the command returned only { id }. Hydrate the response
      // body via GetUser. Authn-completion: the caller's token still carries
      // the OLD (null) claims, so synthesize the post-sync identity from the
      // command outcome — GetUser runs its own authz check against this.
      const syncedActor = {
        ...actor,
        platformUser: { id, role: 'student' as const },
      }
      const result = await getUser.handle({ actor: syncedActor, userId: id })

      res.setHeader('ETag', etagFrom(result))
      res.setHeader('Cache-Control', 'private, no-cache')
      if (created) {
        res.setHeader('Location', `/api/v1/users/${id}`)
      }
      res.status(created ? 201 : 200).json(toUserResponse(result))
    } catch (err) {
      next(err)
    }
  })

  return router
}
