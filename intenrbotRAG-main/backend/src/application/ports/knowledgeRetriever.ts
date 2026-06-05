export interface RetrievedKnowledgeChunk {
  title: string
  section: string
  text: string
  sourceUrl?: string
  similarity?: number
  metadata?: Record<string, string>
}

export interface KnowledgeRetriever {
  search(feature: string, query: string): Promise<RetrievedKnowledgeChunk[]>
}
