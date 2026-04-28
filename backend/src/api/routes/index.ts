import { Router, type Router as ExpressRouter } from 'express'
import type { UnitOfWork } from '../../application/ports/unit-of-work'
import type { PlatformClaimsService } from '../../application/ports/platform-claims-service'
import type { IdGenerator } from '../../application/ports/id-generator'
import { createAuthRouter } from './auth'
import { createUsersRouter } from './users'
import { createSemestersRouter } from './semesters'

export interface ApiRouterDeps {
  uow: UnitOfWork
  platformClaimsService: PlatformClaimsService
  idGenerator: IdGenerator
}

/** Mounts all v1 routes under `/api/v1`. */
export function createApiRouter(deps: ApiRouterDeps): ExpressRouter {
  const router: ExpressRouter = Router()
  router.use('/auth', createAuthRouter(deps))
  router.use('/users', createUsersRouter({ uow: deps.uow }))
  router.use('/semesters', createSemestersRouter({ uow: deps.uow, idGenerator: deps.idGenerator }))
  return router
}
