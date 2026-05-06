import { Router, type Router as ExpressRouter } from 'express'
import type { UnitOfWork } from '../../application/ports/unit-of-work'
import type { IdGenerator } from '../../application/ports/id-generator'
import type { AttachmentStorage } from '../../application/ports/attachment-storage'
import { createUsersRouter } from './users'
import { createSemestersRouter } from './semesters'
import { createOpportunitiesRouter } from './opportunities'
import { createInternshipsRouter } from './internships'
import { createNotificationsRouter } from './notifications'
import { createTicketsRouter } from './tickets'

export interface ApiRouterDeps {
  uow: UnitOfWork
  idGenerator: IdGenerator
  attachmentStorage: AttachmentStorage
  attachmentDownloadTtlMs?: number
}

/** Mounts all v1 routes under `/api/v1`. */
export function createApiRouter(deps: ApiRouterDeps): ExpressRouter {
  const router: ExpressRouter = Router()
  router.use('/users', createUsersRouter({ uow: deps.uow }))
  router.use('/semesters', createSemestersRouter({ uow: deps.uow, idGenerator: deps.idGenerator }))
  router.use(
    '/opportunities',
    createOpportunitiesRouter({
      uow: deps.uow,
      idGenerator: deps.idGenerator,
      attachmentStorage: deps.attachmentStorage,
      attachmentDownloadTtlMs: deps.attachmentDownloadTtlMs,
    })
  )
  router.use(
    '/internships',
    createInternshipsRouter({
      uow: deps.uow,
      idGenerator: deps.idGenerator,
      attachmentStorage: deps.attachmentStorage,
      attachmentDownloadTtlMs: deps.attachmentDownloadTtlMs,
    })
  )
  router.use('/notifications', createNotificationsRouter({ uow: deps.uow }))
  router.use('/tickets', createTicketsRouter({ uow: deps.uow, idGenerator: deps.idGenerator }))
  return router
}
