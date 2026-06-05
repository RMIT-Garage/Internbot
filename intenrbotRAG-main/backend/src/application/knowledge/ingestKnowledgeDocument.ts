import type { EmbeddingProvider } from '../ports/embeddingProvider'
import type {
  KnowledgeDocumentRecord,
  KnowledgeRepository,
  CreateKnowledgeDocumentInput,
} from '../ports/knowledgeRepository'
import { ValidationError } from '../../domain/errors'
import { chunkText } from './chunkText'

export interface IngestKnowledgeDocumentInput {
  feature: string
  title: string
  section: string
  content: string
  sourceUrl?: string
}

interface IngestKnowledgeDocumentDependencies {
  repository: KnowledgeRepository
  embeddingProvider: EmbeddingProvider
}

export class IngestKnowledgeDocument {
  private readonly repository: KnowledgeRepository
  private readonly embeddingProvider: EmbeddingProvider

  constructor({ repository, embeddingProvider }: IngestKnowledgeDocumentDependencies) {
    this.repository = repository
    this.embeddingProvider = embeddingProvider
  }

  async execute(input: IngestKnowledgeDocumentInput): Promise<KnowledgeDocumentRecord> {
    const content = input.content.trim()
    if (!content) {
      throw new ValidationError('Knowledge content is required')
    }

    const chunks = chunkText(content)
    if (chunks.length === 0) {
      throw new ValidationError('Knowledge content did not produce any chunks')
    }

    const document = await this.repository.createDocument(toDocumentInput(input, content))
    const chunkRecords = await Promise.all(
      chunks.map(async (chunk) => ({
        feature: input.feature,
        title: input.title,
        section: input.section,
        text: chunk.text,
        chunkIndex: chunk.chunkIndex,
        sourceUrl: input.sourceUrl,
        embedding: await this.embeddingProvider.embed(chunk.text),
      }))
    )

    await this.repository.createChunks(document.id, chunkRecords)

    return document
  }
}

function toDocumentInput(
  input: IngestKnowledgeDocumentInput,
  content: string
): CreateKnowledgeDocumentInput {
  return {
    feature: input.feature,
    title: input.title,
    section: input.section,
    content,
    sourceUrl: input.sourceUrl,
    status: 'ready',
  }
}
