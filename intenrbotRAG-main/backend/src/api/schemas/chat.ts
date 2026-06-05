import '../openapi/extendZodOpenApi'
import { z } from 'zod'
import {
  benchmarkFeatureSchema,
  checkerModelOutputSchema,
  faqModelOutputSchema,
} from '../../application/benchmark/types'

const structuredChatDataSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('checker'), data: checkerModelOutputSchema }),
  z.object({ type: z.literal('faq'), data: faqModelOutputSchema }),
])

const contentBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({ type: z.literal('markdown'), text: z.string() }),
  z.object({ type: z.literal('citation'), label: z.string(), url: z.string().optional() }),
])

const chatSourceSchema = z.object({
  title: z.string(),
  section: z.string(),
  sourceUrl: z.string().optional(),
  excerpt: z.string().optional(),
})

const webSourceSchema = z.object({
  title: z.string(),
  uri: z.string(),
})

/** Request body for POST /api/chat/message and POST /api/v1/chat/message */
export const chatMessageRequestSchema = z.object({
  feature: benchmarkFeatureSchema,
  userInput: z.string().min(1).openapi({ example: 'Who can apply for the internship?' }),
  fileContext: z.string().max(1_000_000).optional(),
  attachment: z
    .object({
      mimeType: z.string().min(1).max(120),
      dataBase64: z.string().min(1).max(2_000_000),
      fileName: z.string().min(1).max(260).optional(),
    })
    .optional(),
  model: z.string().min(1).max(120).optional(),
  useWebSearch: z.boolean().optional(),
})

export type ChatMessageRequest = z.infer<typeof chatMessageRequestSchema>

/** Response body from ChatService — shared by legacy and v1 chat routes */
export const chatMessageResponseSchema = z.object({
  reply: z.string(),
  feature: benchmarkFeatureSchema,
  structuredData: structuredChatDataSchema.optional(),
  contentType: z.enum(['plain', 'markdown', 'structured']).optional(),
  contentVersion: z.literal('v1').optional(),
  contentBlocks: z.array(contentBlockSchema).optional(),
  sources: z.array(chatSourceSchema),
  webSources: z.array(webSourceSchema).optional(),
  debug: z
    .object({
      webSearch: z.object({
        requested: z.boolean(),
        attempted: z.boolean(),
        used: z.boolean(),
        sourceCount: z.number(),
        fallbackTriggered: z.boolean(),
      }),
    })
    .optional(),
})

export const chatModelsResponseSchema = z.object({
  models: z.array(z.string()),
})

export type ChatModelsResponse = z.infer<typeof chatModelsResponseSchema>
