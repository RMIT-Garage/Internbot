import { Router, type Router as ExpressRouter } from 'express'
import type { Request, Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth'
import { ApiError } from '../errors'
import {
  createSemesterRequestSchema,
  patchSemesterRequestSchema,
  transitionSemesterRequestSchema,
  FORBIDDEN_PATCH_SEMESTER_FIELDS,
} from '../schemas/semester'
import {
  toCreateSemesterCommand,
  toUpdateSemesterCommand,
  toTransitionSemesterCommand,
  toSemesterResponse,
  toSemesterListResponse,
  etagFromSemester,
  parseListSemestersQuery,
} from '../mappers/semester'
import {
  parseListSemesterStudentsQuery,
  toSemesterStudentListResponse,
} from '../mappers/semester-student'
import { CreateSemesterCommandHandler } from '../../application/commands/create-semester'
import { UpdateSemesterCommandHandler } from '../../application/commands/update-semester'
import { TransitionSemesterCommandHandler } from '../../application/commands/transition-semester'
import { GetSemesterQueryHandler } from '../../application/queries/get-semester'
import { ListSemestersQueryHandler } from '../../application/queries/list-semesters'
import { ListSemesterStudentsQueryHandler } from '../../application/queries/list-semester-students'
import type { UnitOfWork } from '../../application/ports/unit-of-work'
import type { IdGenerator } from '../../application/ports/id-generator'
import type { AuthorizationService } from '../../application/ports/authorization-service'
import type { SemesterQueryService } from '../../application/ports/queries/semester-query-service'
import type { SemesterStudentQueryService } from '../../application/ports/queries/semester-student-query-service'
import { clampLimit } from '../utils/pagination'

export interface SemestersRouterDeps {
  uow: UnitOfWork
  idGenerator: IdGenerator
  authz: AuthorizationService
  semesterQueries: SemesterQueryService
  semesterStudentQueries: SemesterStudentQueryService
}

/**
 * `/semesters` router — five endpoints per WORKFLOW-API-SPEC.md §7.5:
 *   GET    /semesters
 *   GET    /semesters/:id
 *   POST   /semesters
 *   PATCH  /semesters/:id
 *   POST   /semesters/:id/transitions
 *
 * Route handlers do auth-context lookup + body validation + dispatch +
 * serialization only. All authorization (role checks) lives inside the
 * CQRS handlers — keeps the API layer business-logic-free.
 */
export function createSemestersRouter(deps: SemestersRouterDeps): ExpressRouter {
  const router: ExpressRouter = Router()
  const createSemester = new CreateSemesterCommandHandler(deps.uow, deps.authz, deps.idGenerator)
  const updateSemester = new UpdateSemesterCommandHandler(deps.uow, deps.authz)
  const transitionSemester = new TransitionSemesterCommandHandler(
    deps.uow,
    deps.authz,
    deps.idGenerator
  )
  const getSemester = new GetSemesterQueryHandler(deps.semesterQueries, deps.authz)
  const listSemesters = new ListSemestersQueryHandler(deps.semesterQueries, deps.authz)
  const listSemesterStudents = new ListSemesterStudentsQueryHandler(
    deps.semesterStudentQueries,
    deps.semesterQueries,
    deps.authz
  )

  // ---------- LIST ----------
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const limit = clampLimit(req.query['limit'])
      const parsed = parseListSemestersQuery(req.query as Record<string, unknown>, limit)
      if (parsed.errors.length > 0) {
        next(
          new ApiError(400, 'Bad Request', parsed.errors[0]!.message, {
            reason: 'invalid_query',
            fields: parsed.errors,
          })
        )
        return
      }

      const result = await listSemesters.handle({ actor, filter: parsed.query })
      res.status(200).json(toSemesterListResponse(result))
    } catch (err) {
      next(err)
    }
  })

  // ---------- LIST STUDENTS ----------
  router.get('/:id/students', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const semesterId = paramId(req)
      const limit = clampLimit(req.query['limit'])
      const params = parseListSemesterStudentsQuery(req.query as Record<string, unknown>, limit)
      const result = await listSemesterStudents.handle({
        actor,
        semesterId,
        filter: params,
      })
      res.status(200).json(toSemesterStudentListResponse(result))
    } catch (err) {
      next(err)
    }
  })

  // ---------- GET ----------
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const semesterId = paramId(req)
      const result = await getSemester.handle({ actor, semesterId })
      res.setHeader('ETag', etagFromSemester(result))
      res.setHeader('Cache-Control', 'private, no-cache')
      res.status(200).json(toSemesterResponse(result))
    } catch (err) {
      next(err)
    }
  })

  // ---------- CREATE ----------
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createSemesterRequestSchema.safeParse(req.body)
      if (!parsed.success) {
        const issue = parsed.error.issues[0]
        // Distinguish missing-required (422) from malformed-value (400) per
        // WORKFLOW-API-SPEC.md §7.0: "400 = can't parse; 422 = parsed but
        // breaks a rule." Zod v4 reports both as `invalid_type`; only the
        // message carries the "received undefined" hint that flags a missing
        // required key (no structured `received` field in v4).
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

      const { actor } = req as AuthenticatedRequest
      const cmd = toCreateSemesterCommand(actor, parsed.data)
      const { id } = await createSemester.handle(cmd)
      const result = await getSemester.handle({ actor, semesterId: id })

      res.setHeader('Location', `/api/v1/semesters/${id}`)
      res.setHeader('ETag', etagFromSemester(result))
      res.setHeader('Cache-Control', 'private, no-cache')
      res.status(201).json(toSemesterResponse(result))
    } catch (err) {
      next(err)
    }
  })

  // ---------- PATCH ----------
  router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const semesterId = paramId(req)

      const rawBody = (req.body ?? {}) as Record<string, unknown>
      const forbidden = Object.keys(rawBody).filter((k) => FORBIDDEN_PATCH_SEMESTER_FIELDS.has(k))
      if (forbidden.length > 0) {
        next(
          new ApiError(400, 'Bad Request', 'Body contains non-writable fields', {
            reason: 'immutable_field',
            fields: forbidden.map((field) => ({
              field,
              code: 'immutable',
              message: `${field} is not writable through PATCH /semesters/:id`,
            })),
          })
        )
        return
      }

      const parsed = patchSemesterRequestSchema.safeParse(rawBody)
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

      if (Object.keys(parsed.data).length === 0) {
        next(
          new ApiError(422, 'Unprocessable Entity', 'Request body is empty', {
            reason: 'empty_body',
          })
        )
        return
      }

      const ifMatch = req.header('If-Match')
      const cmd = toUpdateSemesterCommand(actor, semesterId, ifMatch, parsed.data)
      const { id } = await updateSemester.handle(cmd)
      const result = await getSemester.handle({ actor, semesterId: id })

      res.setHeader('ETag', etagFromSemester(result))
      res.setHeader('Cache-Control', 'private, no-cache')
      res.status(200).json(toSemesterResponse(result))
    } catch (err) {
      next(err)
    }
  })

  // ---------- TRANSITION ----------
  router.post('/:id/transitions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const semesterId = paramId(req)

      const parsed = transitionSemesterRequestSchema.safeParse(req.body)
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

      const ifMatch = req.header('If-Match')
      const cmd = toTransitionSemesterCommand(actor, semesterId, ifMatch, parsed.data)
      const { id } = await transitionSemester.handle(cmd)
      const result = await getSemester.handle({ actor, semesterId: id })

      res.setHeader('Location', `/api/v1/semesters/${id}`)
      res.setHeader('ETag', etagFromSemester(result))
      res.setHeader('Cache-Control', 'private, no-cache')
      res.status(201).json(toSemesterResponse(result))
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
