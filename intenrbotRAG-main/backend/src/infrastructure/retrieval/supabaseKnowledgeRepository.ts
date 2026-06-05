import { ValidationError } from '../../domain/errors'
import type {
  KnowledgeRepository,
  KnowledgeDocumentRecord,
  CreateKnowledgeDocumentInput,
  KnowledgeChunkInput,
} from '../../application/ports/knowledgeRepository'
import { getSupabaseClient } from '../config/supabase'

const KNOWLEDGE_DOCUMENTS_TABLE = 'knowledge_documents'
const KNOWLEDGE_CHUNKS_TABLE = 'knowledge_chunks'

interface KnowledgeDocumentRow {
  id: string
  feature: string
  title: string
  section: string
  source_url: string | null
  status: string
  created_at: string
}

export class SupabaseKnowledgeRepository implements KnowledgeRepository {
  async createDocument(input: CreateKnowledgeDocumentInput): Promise<KnowledgeDocumentRecord> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from(KNOWLEDGE_DOCUMENTS_TABLE)
      .insert({
        feature: input.feature,
        title: input.title,
        section: input.section,
        content: input.content,
        source_url: input.sourceUrl ?? null,
        status: input.status,
      })
      .select('id, feature, title, section, source_url, status, created_at')
      .single()

    if (error || !data) {
      throw new ValidationError(
        `Failed to create knowledge document: ${error?.message ?? 'unknown error'}`
      )
    }

    return mapDocumentRow(data)
  }

  async createChunks(documentId: string, chunks: KnowledgeChunkInput[]): Promise<void> {
    const supabase = getSupabaseClient()
    const { error } = await supabase.from(KNOWLEDGE_CHUNKS_TABLE).insert(
      chunks.map((chunk) => ({
        document_id: documentId,
        feature: chunk.feature,
        title: chunk.title,
        section: chunk.section,
        text: chunk.text,
        chunk_index: chunk.chunkIndex,
        embedding: chunk.embedding,
        source_url: chunk.sourceUrl ?? null,
      }))
    )

    if (error) {
      throw new ValidationError(`Failed to create knowledge chunks: ${error.message}`)
    }
  }

  async listDocuments(feature?: string): Promise<KnowledgeDocumentRecord[]> {
    const supabase = getSupabaseClient()
    let query = supabase
      .from(KNOWLEDGE_DOCUMENTS_TABLE)
      .select('id, feature, title, section, source_url, status, created_at')
      .order('created_at', { ascending: false })

    if (feature) {
      query = query.eq('feature', feature)
    }

    const { data, error } = await query
    if (error) {
      throw new ValidationError(`Failed to list knowledge documents: ${error.message}`)
    }

    return ((data ?? []) as KnowledgeDocumentRow[]).map((row: KnowledgeDocumentRow) =>
      mapDocumentRow(row)
    )
  }

  async deleteDocumentsByFeature(feature: string): Promise<number> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from(KNOWLEDGE_DOCUMENTS_TABLE)
      .delete()
      .eq('feature', feature)
      .select('id')

    if (error) {
      throw new ValidationError(`Failed to delete knowledge documents: ${error.message}`)
    }

    return (data ?? []).length
  }
}

function mapDocumentRow(row: KnowledgeDocumentRow): KnowledgeDocumentRecord {
  return {
    id: row.id,
    feature: row.feature,
    title: row.title,
    section: row.section,
    sourceUrl: row.source_url ?? undefined,
    status: row.status,
    createdAt: row.created_at,
  }
}
