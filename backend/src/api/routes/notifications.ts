import { Router, type Router as ExpressRouter } from 'express'
import type { Request, Response, NextFunction } from 'express'
import type { ZodError } from 'zod'
import type { AuthenticatedRequest } from '../middleware/auth'
import { ApiError } from '../errors'
import {
  markAllNotificationsReadRequestSchema,
  markNotificationReadRequestSchema,
} from '../schemas/notification'
import {
  parseListNotificationsQuery,
  toMarkAllNotificationsReadCommand,
  toMarkAllNotificationsReadResponse,
  toMarkNotificationReadCommand,
  toNotificationListResponse,
  toNotificationResponse,
} from '../mappers/notification'
import { ListNotificationsQueryHandler } from '../../application/queries/list-notifications'
import { GetNotificationQueryHandler } from '../../application/queries/get-notification'
import { MarkNotificationReadCommandHandler } from '../../application/commands/mark-notification-read'
import { MarkAllNotificationsReadCommandHandler } from '../../application/commands/mark-all-notifications-read'
import type { UnitOfWork } from '../../application/ports/unit-of-work'
import type { AuthorizationService } from '../../application/ports/authorization-service'
import type { NotificationQueryService } from '../../application/ports/queries/notification-query-service'
import { clampLimit } from '../utils/pagination'

export interface NotificationsRouterDeps {
  uow: UnitOfWork
  authz: AuthorizationService
  notificationQueries: NotificationQueryService
}

export function createNotificationsRouter(deps: NotificationsRouterDeps): ExpressRouter {
  const router: ExpressRouter = Router()
  const listNotifications = new ListNotificationsQueryHandler(deps.notificationQueries, deps.authz)
  const getNotification = new GetNotificationQueryHandler(deps.notificationQueries, deps.authz)
  const markNotificationRead = new MarkNotificationReadCommandHandler(deps.uow, deps.authz)
  const markAllNotificationsRead = new MarkAllNotificationsReadCommandHandler(deps.uow, deps.authz)

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const limit = clampLimit(req.query['limit'])
      const parsed = parseListNotificationsQuery(req.query as Record<string, unknown>, limit)
      if (parsed.errors.length > 0) {
        next(
          new ApiError(400, 'Bad Request', parsed.errors[0]!.message, {
            reason: 'invalid_query',
            fields: parsed.errors,
          })
        )
        return
      }

      const result = await listNotifications.handle({ actor, filter: parsed.query })
      res.setHeader('Cache-Control', 'private, no-cache')
      res.status(200).json(toNotificationListResponse(result))
    } catch (err) {
      next(err)
    }
  })

  router.put('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = markAllNotificationsReadRequestSchema.safeParse(req.body)
      if (!parsed.success) {
        next(zodBodyError(parsed.error))
        return
      }

      const { actor } = req as AuthenticatedRequest
      const result = await markAllNotificationsRead.handle(toMarkAllNotificationsReadCommand(actor))
      res.status(200).json(toMarkAllNotificationsReadResponse(result.markedReadCount))
    } catch (err) {
      next(err)
    }
  })

  router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = markNotificationReadRequestSchema.safeParse(req.body)
      if (!parsed.success) {
        next(zodBodyError(parsed.error))
        return
      }

      const { actor } = req as AuthenticatedRequest
      const notificationId = paramId(req)
      const { id } = await markNotificationRead.handle(
        toMarkNotificationReadCommand(actor, notificationId)
      )
      const result = await getNotification.handle({ actor, notificationId: id })

      res.setHeader('Cache-Control', 'private, no-cache')
      res.status(200).json(toNotificationResponse(result))
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

function zodBodyError(error: ZodError): ApiError {
  const issue = error.issues[0]
  return new ApiError(400, 'Bad Request', issue?.message ?? 'Invalid body', {
    reason: 'invalid_body',
    fields: error.issues.map((i) => ({
      field: i.path.join('.'),
      code: i.code,
      message: i.message,
    })),
  })
}
