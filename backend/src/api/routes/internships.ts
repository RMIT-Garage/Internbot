import { Router, type Router as ExpressRouter } from 'express'
import type { Request, Response, NextFunction } from 'express'
import type { ZodError } from 'zod'
import type { AuthenticatedRequest } from '../middleware/auth'
import { ApiError } from '../errors'
import {
  addInternshipCommentRequestSchema,
  createInternshipAttachmentUploadIntentRequestSchema,
  createInternshipRequestSchema,
  decideInternshipOfferRequestSchema,
  patchInternshipRequestSchema,
  submitInternshipOfferRequestSchema,
  FORBIDDEN_CREATE_INTERNSHIP_FIELDS,
  FORBIDDEN_PATCH_INTERNSHIP_FIELDS,
} from '../schemas/internship'
import {
  etagFromInternship,
  parseListInternshipsQuery,
  toAddInternshipCommentCommand,
  toCreateInternshipAttachmentUploadIntentCommand,
  toCreateInternshipCommand,
  toInternshipActivityResponse,
  toInternshipAttachmentDownloadResponse,
  toInternshipAttachmentUploadIntentResponse,
  toInternshipListResponse,
  toInternshipResponse,
  toDecideInternshipOfferCommand,
  toSubmitInternshipOfferCommand,
  toUpdateInternshipCommand,
  toWithdrawInternshipCommand,
} from '../mappers/internship'
import { CreateInternshipCommandHandler } from '../../application/commands/create-internship'
import { UpdateInternshipCommandHandler } from '../../application/commands/update-internship'
import { SubmitInternshipOfferCommandHandler } from '../../application/commands/submit-internship-offer'
import { AddInternshipCommentCommandHandler } from '../../application/commands/add-internship-comment'
import { DecideInternshipOfferCommandHandler } from '../../application/commands/decide-internship-offer'
import { WithdrawInternshipCommandHandler } from '../../application/commands/withdraw-internship'
import { DeleteInternshipAttachmentCommandHandler } from '../../application/commands/delete-internship-attachment'
import { CreateInternshipAttachmentUploadIntentCommandHandler } from '../../application/commands/create-internship-attachment-upload-intent'
import { ConfirmInternshipAttachmentCommandHandler } from '../../application/commands/confirm-internship-attachment'
import { GetInternshipQueryHandler } from '../../application/queries/get-internship'
import { GetInternshipAttachmentQueryHandler } from '../../application/queries/get-internship-attachment'
import { ListInternshipsQueryHandler } from '../../application/queries/list-internships'
import type { UnitOfWork } from '../../application/ports/unit-of-work'
import type { IdGenerator } from '../../application/ports/id-generator'
import type { AttachmentStorage } from '../../application/ports/attachment-storage'
import type { AuthorizationService } from '../../application/ports/authorization-service'
import type { UserQueryService } from '../../application/ports/queries/user-query-service'
import type { OpportunityQueryService } from '../../application/ports/queries/opportunity-query-service'
import type { InternshipQueryService } from '../../application/ports/queries/internship-query-service'
import type { SemesterQueryService } from '../../application/ports/queries/semester-query-service'
import { clampLimit } from '../utils/pagination'

export interface InternshipsRouterDeps {
  uow: UnitOfWork
  idGenerator: IdGenerator
  attachmentStorage: AttachmentStorage
  authz: AuthorizationService
  userQueries: UserQueryService
  opportunityQueries: OpportunityQueryService
  internshipQueries: InternshipQueryService
  semesterQueries: SemesterQueryService
  attachmentDownloadTtlMs?: number
}

export function createInternshipsRouter(deps: InternshipsRouterDeps): ExpressRouter {
  const router: ExpressRouter = Router()
  const createInternship = new CreateInternshipCommandHandler(
    deps.uow,
    deps.authz,
    deps.idGenerator
  )
  const updateInternship = new UpdateInternshipCommandHandler(
    deps.uow,
    deps.authz,
    deps.idGenerator
  )
  const submitOffer = new SubmitInternshipOfferCommandHandler(
    deps.uow,
    deps.authz,
    deps.idGenerator
  )
  const addComment = new AddInternshipCommentCommandHandler(deps.uow, deps.authz, deps.idGenerator)
  const decideOffer = new DecideInternshipOfferCommandHandler(
    deps.uow,
    deps.authz,
    deps.idGenerator
  )
  const withdrawInternship = new WithdrawInternshipCommandHandler(
    deps.uow,
    deps.authz,
    deps.idGenerator
  )
  const deleteAttachment = new DeleteInternshipAttachmentCommandHandler(deps.uow, deps.authz)
  const confirmAttachment = new ConfirmInternshipAttachmentCommandHandler(deps.uow, deps.authz)
  const createAttachmentUploadIntent = new CreateInternshipAttachmentUploadIntentCommandHandler(
    deps.uow,
    deps.authz,
    deps.idGenerator,
    deps.attachmentStorage
  )
  const getInternship = new GetInternshipQueryHandler(
    deps.internshipQueries,
    deps.opportunityQueries,
    deps.userQueries,
    deps.semesterQueries,
    deps.authz
  )
  const getInternshipAttachment = new GetInternshipAttachmentQueryHandler(
    deps.internshipQueries,
    deps.authz,
    deps.attachmentStorage,
    { ttlMs: deps.attachmentDownloadTtlMs }
  )
  const listInternships = new ListInternshipsQueryHandler(
    deps.internshipQueries,
    deps.opportunityQueries,
    deps.userQueries,
    deps.semesterQueries,
    deps.authz
  )

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const limit = clampLimit(req.query['limit'])
      const parsed = parseListInternshipsQuery(req.query as Record<string, unknown>, limit)
      if (parsed.errors.length > 0) {
        next(
          new ApiError(400, 'Bad Request', parsed.errors[0]!.message, {
            reason: 'invalid_query',
            fields: parsed.errors,
          })
        )
        return
      }

      const result = await listInternships.handle({ actor, filter: parsed.query })
      res.status(200).json(toInternshipListResponse(result))
    } catch (err) {
      next(err)
    }
  })

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const result = await getInternship.handle({ actor, internshipId: paramId(req) })
      res.setHeader('ETag', etagFromInternship(result))
      res.setHeader('Cache-Control', 'private, no-cache')
      res.status(200).json(toInternshipResponse(result))
    } catch (err) {
      next(err)
    }
  })

  router.get(
    '/:id/attachments/:attachmentId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { actor } = req as AuthenticatedRequest
        const result = await getInternshipAttachment.handle({
          actor,
          internshipId: paramId(req),
          attachmentId: paramAttachmentId(req),
        })
        res.setHeader('Cache-Control', 'private, no-store')
        res.status(200).json(toInternshipAttachmentDownloadResponse(result))
      } catch (err) {
        next(err)
      }
    }
  )

  router.delete(
    '/:id/attachments/:attachmentId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { actor } = req as AuthenticatedRequest
        await deleteAttachment.handle({
          actor,
          internshipId: paramId(req),
          attachmentId: paramAttachmentId(req),
        })
        res.status(204).send()
      } catch (err) {
        next(err)
      }
    }
  )

  router.post(
    '/:id/attachments/:attachmentId/confirm',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { actor } = req as AuthenticatedRequest
        const { id } = await confirmAttachment.handle({
          actor,
          internshipId: paramId(req),
          attachmentId: paramAttachmentId(req),
        })
        const result = await getInternship.handle({ actor, internshipId: id })
        res.setHeader('ETag', etagFromInternship(result))
        res.setHeader('Cache-Control', 'private, no-cache')
        res.status(200).json(toInternshipResponse(result))
      } catch (err) {
        next(err)
      }
    }
  )

  router.post(
    '/:id/attachments/upload-intents',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = createInternshipAttachmentUploadIntentRequestSchema.safeParse(req.body)
        if (!parsed.success) {
          next(zodBodyError(parsed.error))
          return
        }
        const { actor } = req as AuthenticatedRequest
        const result = await createAttachmentUploadIntent.handle(
          toCreateInternshipAttachmentUploadIntentCommand(actor, paramId(req), parsed.data)
        )
        res.setHeader('Cache-Control', 'private, no-store')
        res
          .status(201)
          .json(toInternshipAttachmentUploadIntentResponse(result, parsed.data.contentType))
      } catch (err) {
        next(err)
      }
    }
  )

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawBody = (req.body ?? {}) as Record<string, unknown>
      const forbidden = forbiddenFields(rawBody, FORBIDDEN_CREATE_INTERNSHIP_FIELDS)
      if (forbidden.length > 0) {
        next(immutableFieldsError(forbidden, 'POST /internships'))
        return
      }

      const parsed = createInternshipRequestSchema.safeParse(rawBody)
      if (!parsed.success) {
        next(zodBodyError(parsed.error))
        return
      }

      const { actor } = req as AuthenticatedRequest
      const { id } = await createInternship.handle(toCreateInternshipCommand(actor, parsed.data))
      const result = await getInternship.handle({ actor, internshipId: id })

      res.setHeader('Location', `/api/v1/internships/${id}`)
      res.setHeader('ETag', etagFromInternship(result))
      res.setHeader('Cache-Control', 'private, no-cache')
      res.status(201).json(toInternshipResponse(result))
    } catch (err) {
      next(err)
    }
  })

  router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const internshipId = paramId(req)
      const rawBody = (req.body ?? {}) as Record<string, unknown>
      const forbidden = forbiddenFields(rawBody, FORBIDDEN_PATCH_INTERNSHIP_FIELDS)
      if (forbidden.length > 0) {
        next(immutableFieldsError(forbidden, 'PATCH /internships/:id'))
        return
      }

      const parsed = patchInternshipRequestSchema.safeParse(rawBody)
      if (!parsed.success) {
        next(zodBodyError(parsed.error, false))
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

      const { id } = await updateInternship.handle(
        toUpdateInternshipCommand(actor, internshipId, req.header('If-Match'), parsed.data)
      )
      const result = await getInternship.handle({ actor, internshipId: id })

      res.setHeader('ETag', etagFromInternship(result))
      res.setHeader('Cache-Control', 'private, no-cache')
      res.status(200).json(toInternshipResponse(result))
    } catch (err) {
      next(err)
    }
  })

  router.post('/:id/offer-submissions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const internshipId = paramId(req)
      const parsed = submitInternshipOfferRequestSchema.safeParse(req.body)
      if (!parsed.success) {
        next(zodBodyError(parsed.error))
        return
      }

      const { id } = await submitOffer.handle(
        toSubmitInternshipOfferCommand(actor, internshipId, req.header('If-Match'), parsed.data)
      )
      const result = await getInternship.handle({ actor, internshipId: id })

      res.setHeader('Location', `/api/v1/internships/${id}`)
      res.setHeader('ETag', etagFromInternship(result))
      res.setHeader('Cache-Control', 'private, no-cache')
      res.status(201).json(toInternshipResponse(result))
    } catch (err) {
      next(err)
    }
  })

  router.post('/:id/comments', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const internshipId = paramId(req)
      const parsed = addInternshipCommentRequestSchema.safeParse(req.body)
      if (!parsed.success) {
        next(zodBodyError(parsed.error))
        return
      }

      const result = await addComment.handle(
        toAddInternshipCommentCommand(actor, internshipId, parsed.data)
      )

      res.setHeader(
        'Location',
        `/api/v1/internships/${internshipId}/activity/${result.activity.id}`
      )
      res.status(201).json(toInternshipActivityResponse(result))
    } catch (err) {
      next(err)
    }
  })

  router.post('/:id/decisions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const internshipId = paramId(req)
      const parsed = decideInternshipOfferRequestSchema.safeParse(req.body)
      if (!parsed.success) {
        next(zodBodyError(parsed.error))
        return
      }

      const { id } = await decideOffer.handle(
        toDecideInternshipOfferCommand(actor, internshipId, req.header('If-Match'), parsed.data)
      )
      const result = await getInternship.handle({ actor, internshipId: id })

      res.setHeader('Location', `/api/v1/internships/${id}`)
      res.setHeader('ETag', etagFromInternship(result))
      res.setHeader('Cache-Control', 'private, no-cache')
      res.status(201).json(toInternshipResponse(result))
    } catch (err) {
      next(err)
    }
  })

  router.post('/:id/withdrawals', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actor } = req as AuthenticatedRequest
      const internshipId = paramId(req)

      const { id } = await withdrawInternship.handle(
        toWithdrawInternshipCommand(actor, internshipId, req.header('If-Match'))
      )
      const result = await getInternship.handle({ actor, internshipId: id })

      res.setHeader('Location', `/api/v1/internships/${id}`)
      res.setHeader('ETag', etagFromInternship(result))
      res.setHeader('Cache-Control', 'private, no-cache')
      res.status(201).json(toInternshipResponse(result))
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

function paramAttachmentId(req: Request): string {
  const raw = req.params['attachmentId']
  return Array.isArray(raw) ? raw[0]! : raw!
}

function forbiddenFields(
  rawBody: Record<string, unknown>,
  forbidden: ReadonlySet<string>
): string[] {
  return Object.keys(rawBody).filter((k) => forbidden.has(k))
}

function immutableFieldsError(fields: readonly string[], route: string): ApiError {
  return new ApiError(400, 'Bad Request', 'Body contains non-writable fields', {
    reason: 'immutable_field',
    fields: fields.map((field) => ({
      field,
      code: 'immutable',
      message: `${field} is not writable through ${route}`,
    })),
  })
}

function zodBodyError(error: ZodError, detectMissing = true): ApiError {
  const issue = error.issues[0]
  const isMissing =
    detectMissing &&
    issue?.code === 'invalid_type' &&
    /received undefined/.test(issue.message ?? '')
  const issuePath = issue?.path.join('.')
  const isEmptyText =
    issue?.code === 'too_small' && (issuePath === 'text' || issuePath === 'comment')
  const status = isMissing || isEmptyText ? 422 : 400
  const reason = isMissing
    ? 'missing_required_field'
    : isEmptyText
      ? 'missing_required_field'
      : 'invalid_body'
  return new ApiError(
    status,
    status === 422 ? 'Unprocessable Entity' : 'Bad Request',
    issue?.message ?? 'Invalid body',
    {
      reason,
      fields: error.issues.map((i) => ({
        field: i.path.join('.'),
        code: i.code,
        message: i.message,
      })),
    }
  )
}
