import { z } from 'zod'

export const knowledgeDocumentSchema = z.object({
  feature: z.string().min(1, 'Feature is required'),
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  section: z
    .string()
    .min(1, 'Section is required')
    .max(200, 'Section must be less than 200 characters'),
  sourceUrl: z.union([z.literal(''), z.string().url('Enter a valid URL')]).optional(),
  content: z.string().min(1, 'Content is required'),
})

export type KnowledgeDocumentInput = z.infer<typeof knowledgeDocumentSchema>
