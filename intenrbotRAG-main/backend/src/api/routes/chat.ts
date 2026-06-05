import { Router, type Router as ExpressRouter } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { ChatService } from '../../application/chat/ChatService'
import { ValidationError } from '../../domain/errors'
import { GeminiModelProvider } from '../../infrastructure/ai/geminiProvider'
import { SupabaseKnowledgeRetriever } from '../../infrastructure/retrieval/supabaseKnowledgeRetriever'
import { listGeminiGenerateModels, normalizeModelName } from '../chat/geminiModels'
import { chatMessageRequestSchema } from '../schemas/chat'

export const chatRouter: ExpressRouter = Router()

function createChatService(model?: string): ChatService {
  return new ChatService({
    provider: new GeminiModelProvider({ model }),
    knowledgeRetriever: new SupabaseKnowledgeRetriever(),
  })
}

chatRouter.post('/message', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = chatMessageRequestSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ValidationError('Invalid request payload')
    }

    const { feature, userInput, fileContext, attachment, model, useWebSearch } = parsed.data
    const webSearchEnabled = process.env.GEMINI_ENABLE_GOOGLE_SEARCH !== 'false'
    const response = await createChatService(normalizeModelName(model)).generateResponse(
      feature,
      userInput,
      fileContext,
      attachment,
      webSearchEnabled && (useWebSearch ?? false)
    )

    res.json(response)
  } catch (error) {
    next(error)
  }
})

chatRouter.get('/models', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const models = await listGeminiGenerateModels()
    res.json({ models })
  } catch (error) {
    next(error)
  }
})
