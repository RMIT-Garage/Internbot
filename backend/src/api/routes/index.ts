import { Router, type Router as ExpressRouter } from 'express'
import type { UnitOfWork } from '../../application/ports/unit-of-work'
import type { IdGenerator } from '../../application/ports/id-generator'
import type { AttachmentStorage } from '../../application/ports/attachment-storage'
import type { AuthorizationService } from '../../application/ports/authorization-service'
import type { UserQueryService } from '../../application/ports/queries/user-query-service'
import type { SemesterQueryService } from '../../application/ports/queries/semester-query-service'
import type { SemesterStudentQueryService } from '../../application/ports/queries/semester-student-query-service'
import type { OpportunityQueryService } from '../../application/ports/queries/opportunity-query-service'
import type { InternshipQueryService } from '../../application/ports/queries/internship-query-service'
import type { NotificationQueryService } from '../../application/ports/queries/notification-query-service'
import type { TicketQueryService } from '../../application/ports/queries/ticket-query-service'
import type { ActivityFeedQueryService } from '../../application/ports/queries/activity-feed-query-service'
import { createUsersRouter } from './users'
import { createSemestersRouter } from './semesters'
import { createOpportunitiesRouter } from './opportunities'
import { createInternshipsRouter } from './internships'
import { createNotificationsRouter } from './notifications'
import { createTicketsRouter } from './tickets'
import { createAdvisorRouter } from './advisor'
import { createCoordinatorAiRouter } from './coordinator-ai'

export interface ApiRouterDeps {
  uow: UnitOfWork
  idGenerator: IdGenerator
  attachmentStorage: AttachmentStorage
  authz: AuthorizationService
  userQueries: UserQueryService
  semesterQueries: SemesterQueryService
  semesterStudentQueries: SemesterStudentQueryService
  opportunityQueries: OpportunityQueryService
  internshipQueries: InternshipQueryService
  notificationQueries: NotificationQueryService
  ticketQueries: TicketQueryService
  activityFeedQueries: ActivityFeedQueryService
  attachmentDownloadTtlMs?: number
}

/** Mounts all v1 routes under `/api/v1`. */
export function createApiRouter(deps: ApiRouterDeps): ExpressRouter {
  const router: ExpressRouter = Router()
  router.use(
    '/users',
    createUsersRouter({
      uow: deps.uow,
      authz: deps.authz,
      userQueries: deps.userQueries,
      semesterQueries: deps.semesterQueries,
      internshipQueries: deps.internshipQueries,
      activityFeedQueries: deps.activityFeedQueries,
    })
  )
  router.use(
    '/semesters',
    createSemestersRouter({
      uow: deps.uow,
      idGenerator: deps.idGenerator,
      authz: deps.authz,
      semesterQueries: deps.semesterQueries,
      semesterStudentQueries: deps.semesterStudentQueries,
    })
  )
  router.use(
    '/opportunities',
    createOpportunitiesRouter({
      uow: deps.uow,
      idGenerator: deps.idGenerator,
      attachmentStorage: deps.attachmentStorage,
      authz: deps.authz,
      userQueries: deps.userQueries,
      opportunityQueries: deps.opportunityQueries,
      attachmentDownloadTtlMs: deps.attachmentDownloadTtlMs,
    })
  )
  router.use(
    '/internships',
    createInternshipsRouter({
      uow: deps.uow,
      idGenerator: deps.idGenerator,
      attachmentStorage: deps.attachmentStorage,
      authz: deps.authz,
      userQueries: deps.userQueries,
      opportunityQueries: deps.opportunityQueries,
      internshipQueries: deps.internshipQueries,
      attachmentDownloadTtlMs: deps.attachmentDownloadTtlMs,
    })
  )
  router.use(
    '/notifications',
    createNotificationsRouter({
      uow: deps.uow,
      authz: deps.authz,
      notificationQueries: deps.notificationQueries,
    })
  )
  router.use(
    '/tickets',
    createTicketsRouter({
      uow: deps.uow,
      idGenerator: deps.idGenerator,
      authz: deps.authz,
      ticketQueries: deps.ticketQueries,
    })
  )
  router.use('/advisor', createAdvisorRouter())
  router.use('/coordinator/ai', createCoordinatorAiRouter({ authz: deps.authz }))
  return router
}
