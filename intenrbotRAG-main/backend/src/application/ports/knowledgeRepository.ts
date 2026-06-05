export interface KnowledgeDocumentRecord {
  id: string
  feature: string
  title: string
  section: string
  sourceUrl?: string
  status: string
  createdAt: string
}

export interface KnowledgeChunkInput {
  feature: string
  title: string
  section: string
  text: string
  chunkIndex: number
  embedding: number[]
  sourceUrl?: string
}

export interface CreateKnowledgeDocumentInput {
  feature: string
  title: string
  section: string
  content: string
  sourceUrl?: string
  status: string
}

export interface KnowledgeRepository {
  createDocument(input: CreateKnowledgeDocumentInput): Promise<KnowledgeDocumentRecord>
  createChunks(documentId: string, chunks: KnowledgeChunkInput[]): Promise<void>
  listDocuments(feature?: string): Promise<KnowledgeDocumentRecord[]>
  deleteDocumentsByFeature(feature: string): Promise<number>
}
