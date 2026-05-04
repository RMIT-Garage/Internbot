import { Router, type Router as ExpressRouter } from 'express'
import type { UnitOfWork } from '../../application/ports/unit-of-work'
import type { IdGenerator } from '../../application/ports/id-generator'
import { createUsersRouter } from './users'
import { createSemestersRouter } from './semesters'
import { createOpportunitiesRouter } from './opportunities'

export interface ApiRouterDeps {
  uow: UnitOfWork
  idGenerator: IdGenerator
}

/** Mounts all v1 routes under `/api/v1`. */
export function createApiRouter(deps: ApiRouterDeps): ExpressRouter {
  const router: ExpressRouter = Router()
  router.use('/users', createUsersRouter({ uow: deps.uow }))
  router.use('/semesters', createSemestersRouter({ uow: deps.uow, idGenerator: deps.idGenerator }))
  router.use(
    '/opportunities',
    createOpportunitiesRouter({ uow: deps.uow, idGenerator: deps.idGenerator })
  )
  return router
}
