import { ValidationError } from '../../domain/errors'
import type { EmbeddingProvider } from '../../application/ports/embeddingProvider'
import type {
  KnowledgeRetriever,
  RetrievedKnowledgeChunk,
} from '../../application/ports/knowledgeRetriever'
import { GeminiEmbeddingProvider } from '../ai/geminiEmbeddingProvider'
import { getSupabaseClient } from '../config/supabase'

interface MatchKnowledgeChunkRow {
  title: string | null
  section: string | null
  text: string | null
  source_url: string | null
  similarity: number | null
}

interface SupabaseKnowledgeRetrieverOptions {
  embeddingProvider?: EmbeddingProvider
}

export class SupabaseKnowledgeRetriever implements KnowledgeRetriever {
  private readonly embeddingProvider: EmbeddingProvider

  constructor(options: SupabaseKnowledgeRetrieverOptions = {}) {
    this.embeddingProvider = options.embeddingProvider ?? new GeminiEmbeddingProvider()
  }

  async search(feature: string, query: string): Promise<RetrievedKnowledgeChunk[]> {
    if (
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      !process.env.GEMINI_API_KEY
    ) {
      return []
    }

    const embedding = await this.embeddingProvider.embed(query)
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('match_knowledge_chunks', {
      filter_feature: feature,
      match_count: 8,
      query_embedding: embedding,
    })

    if (error) {
      throw new ValidationError(`Supabase knowledge retrieval failed: ${error.message}`)
    }

    return ((data ?? []) as MatchKnowledgeChunkRow[]).flatMap((row: MatchKnowledgeChunkRow) =>
      mapChunkRow(row)
    )
  }
}

function mapChunkRow(row: MatchKnowledgeChunkRow): RetrievedKnowledgeChunk[] {
  if (!row.title || !row.section || !row.text) {
    return []
  }

  return [
    {
      title: row.title,
      section: row.section,
      text: row.text,
      sourceUrl: row.source_url ?? undefined,
      similarity: row.similarity ?? undefined,
    },
  ]
}
