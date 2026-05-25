import express, { type Express, type RequestHandler } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { createAuthMiddleware } from './middleware/auth'
import { errorHandler } from './middleware/error-handler'
import { healthRouter } from './routes/health'
import { createApiRouter } from './routes'
import { createOpenapiRouter } from './routes/openapi'
import { verifyFirebaseToken, type VerifyToken } from './auth/firebase-token-verifier'
import { createPlatformUserHydrator, type HydratePlatformUser } from './auth/platform-user-hydrator'
import { firestoreUnitOfWork } from '../infrastructure/firestore/firestore-unit-of-work'
import { firestoreIdGenerator } from '../infrastructure/firestore/firestore-id-generator'
import { gcsAttachmentStorage } from '../infrastructure/storage/gcs-attachment-storage'
import { defaultAuthorizationService } from '../infrastructure/authorization/default-authorization-service'
import { firestoreUserQueryService } from '../infrastructure/firestore/firestore-user-query-service'
import { firestoreSemesterQueryService } from '../infrastructure/firestore/firestore-semester-query-service'
import { firestoreSemesterStudentQueryService } from '../infrastructure/firestore/firestore-semester-student-query-service'
import { firestoreOpportunityQueryService } from '../infrastructure/firestore/firestore-opportunity-query-service'
import { firestoreInternshipQueryService } from '../infrastructure/firestore/firestore-internship-query-service'
import { firestoreNotificationQueryService } from '../infrastructure/firestore/firestore-notification-query-service'
import { firestoreTicketQueryService } from '../infrastructure/firestore/firestore-ticket-query-service'
import { firestoreActivityFeedQueryService } from '../infrastructure/firestore/firestore-activity-feed-query-service'
import type { UnitOfWork } from '../application/ports/unit-of-work'
import type { IdGenerator } from '../application/ports/id-generator'
import type { AttachmentStorage } from '../application/ports/attachment-storage'
import type { AuthorizationService } from '../application/ports/authorization-service'
import type { UserQueryService } from '../application/ports/queries/user-query-service'
import type { SemesterQueryService } from '../application/ports/queries/semester-query-service'
import type { SemesterStudentQueryService } from '../application/ports/queries/semester-student-query-service'
import type { OpportunityQueryService } from '../application/ports/queries/opportunity-query-service'
import type { InternshipQueryService } from '../application/ports/queries/internship-query-service'
import type { NotificationQueryService } from '../application/ports/queries/notification-query-service'
import type { TicketQueryService } from '../application/ports/queries/ticket-query-service'
import type { ActivityFeedQueryService } from '../application/ports/queries/activity-feed-query-service'

export interface AppOptions {
  verifyToken?: VerifyToken
  hydratePlatformUser?: HydratePlatformUser
  uow?: UnitOfWork
  idGenerator?: IdGenerator
  attachmentStorage?: AttachmentStorage
  authz?: AuthorizationService
  userQueries?: UserQueryService
  semesterQueries?: SemesterQueryService
  semesterStudentQueries?: SemesterStudentQueryService
  opportunityQueries?: OpportunityQueryService
  internshipQueries?: InternshipQueryService
  notificationQueries?: NotificationQueryService
  ticketQueries?: TicketQueryService
  activityFeedQueries?: ActivityFeedQueryService
  attachmentDownloadTtlMs?: number
}

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    type: 'https://httpstatuses.io/429',
    title: 'Too Many Requests',
    status: 429,
    detail: 'Too many requests, please try again later',
    error: {
      code: 'rate_limited',
      message: 'Too many requests, please try again later',
    },
  },
})

/**
 * Express app factory — composition root.
 *
 * Production defaults: Firebase token verifier + Firestore-backed platform-user
 * hydrator (Pattern B: identity resolved at the edge on every request, not
 * read from custom claims). Tests inject mocks via `AppOptions`.
 */
export function createApp(options: AppOptions = {}): Express {
  const uow = options.uow ?? firestoreUnitOfWork
  const idGenerator = options.idGenerator ?? firestoreIdGenerator
  const attachmentStorage = options.attachmentStorage ?? gcsAttachmentStorage
  const authz = options.authz ?? defaultAuthorizationService
  const userQueries = options.userQueries ?? firestoreUserQueryService
  const semesterQueries = options.semesterQueries ?? firestoreSemesterQueryService
  const opportunityQueries = options.opportunityQueries ?? firestoreOpportunityQueryService
  const internshipQueries = options.internshipQueries ?? firestoreInternshipQueryService
  const notificationQueries = options.notificationQueries ?? firestoreNotificationQueryService
  const ticketQueries = options.ticketQueries ?? firestoreTicketQueryService
  const semesterStudentQueries =
    options.semesterStudentQueries ?? firestoreSemesterStudentQueryService
  const activityFeedQueries = options.activityFeedQueries ?? firestoreActivityFeedQueryService
  const verifyToken = options.verifyToken ?? verifyFirebaseToken
  const hydratePlatformUser =
    options.hydratePlatformUser ?? createPlatformUserHydrator(userQueries, uow, idGenerator)

  const app = express()
  const authMiddleware = createAuthMiddleware(verifyToken, hydratePlatformUser)

  app.use(helmet())
  app.use(cors({ origin: process.env.CORS_ORIGIN ?? false }))
  app.use(globalLimiter as unknown as RequestHandler)
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true, limit: '1mb' }))

  app.use('/api/health', healthRouter)
  app.use('/api', createOpenapiRouter())

  app.use(
    '/api/v1',
    authMiddleware,
    createApiRouter({
      uow,
      idGenerator,
      attachmentStorage,
      authz,
      userQueries,
      semesterQueries,
      semesterStudentQueries,
      opportunityQueries,
      internshipQueries,
      notificationQueries,
      ticketQueries,
      activityFeedQueries,
      attachmentDownloadTtlMs: options.attachmentDownloadTtlMs,
    })
  )

  app.use((_req, res) => {
    res.status(404).json({
      type: 'https://httpstatuses.io/404',
      title: 'Not Found',
      status: 404,
      detail: 'The requested resource does not exist',
      error: {
        code: 'not_found',
        message: 'The requested resource does not exist',
      },
    })
  })

  app.use(errorHandler)

  return app
}
