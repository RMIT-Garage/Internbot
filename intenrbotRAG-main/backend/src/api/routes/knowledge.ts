import {
  Router,
  type Request,
  type Response,
  type NextFunction,
  type Router as ExpressRouter,
} from 'express'
import { z } from 'zod'
import { IngestKnowledgeDocument } from '../../application/knowledge/ingestKnowledgeDocument'
import type { AuthenticatedRequest } from '../middleware/auth'
import { ApiError } from '../errors'
import { ForbiddenError } from '../../domain/errors'
import { SupabaseKnowledgeRepository } from '../../infrastructure/retrieval/supabaseKnowledgeRepository'
import { GeminiEmbeddingProvider } from '../../infrastructure/ai/geminiEmbeddingProvider'

const router: ExpressRouter = Router()

function getRepository(): SupabaseKnowledgeRepository {
  return new SupabaseKnowledgeRepository()
}

function createIngestKnowledgeDocument(): IngestKnowledgeDocument {
  return new IngestKnowledgeDocument({
    repository: getRepository(),
    embeddingProvider: new GeminiEmbeddingProvider(),
  })
}

const createKnowledgeDocumentSchema = z.object({
  feature: z.string().min(1),
  title: z.string().min(1).max(200),
  section: z.string().min(1).max(200),
  content: z.string().min(1),
  sourceUrl: z.string().url().optional().or(z.literal('')),
})

function assertAdmin(req: Request): void {
  const { actor } = req as AuthenticatedRequest
  if (actor.claims?.admin !== true) {
    throw new ForbiddenError('Admin access is required')
  }
}

router.get('/documents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertAdmin(req)
    const feature =
      typeof req.query.feature === 'string' && req.query.feature.length > 0
        ? req.query.feature
        : undefined
    const documents = await getRepository().listDocuments(feature)
    res.json({ documents })
  } catch (error) {
    next(error)
  }
})

router.post('/documents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertAdmin(req)

    const parsed = createKnowledgeDocumentSchema.safeParse(req.body)
    if (!parsed.success) {
      return next(
        new ApiError(400, 'Bad Request', parsed.error.issues[0]?.message ?? 'Invalid request body')
      )
    }

    const document = await createIngestKnowledgeDocument().execute({
      feature: parsed.data.feature,
      title: parsed.data.title,
      section: parsed.data.section,
      content: parsed.data.content,
      sourceUrl: parsed.data.sourceUrl || undefined,
    })

    res.status(201).json({ document })
  } catch (error) {
    next(error)
  }
})

export { router as knowledgeRouter }
