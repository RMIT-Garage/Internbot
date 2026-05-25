import type { ContentBlock } from '@/components/shared/MessageBodyRenderer'

export type { ContentBlock }

export type MessageRole = 'user' | 'assistant'

export interface ChatSource {
  title: string
  section: string
  sourceUrl?: string
}

export interface WebSource {
  title: string
  uri: string
}

export interface CoordinatorMessage {
  id: string
  role: MessageRole
  content: string
  contentType?: 'plain' | 'markdown' | 'structured'
  contentBlocks?: ContentBlock[]
  sources?: ChatSource[]
  webSources?: WebSource[]
  isStreaming?: boolean
}

export interface CoordinatorChatResponse {
  reply: string
  contentType?: 'plain' | 'markdown' | 'structured'
  contentBlocks?: ContentBlock[]
  sources: ChatSource[]
  webSources?: WebSource[]
}

export interface CheckerAttachment {
  mimeType: string
  dataBase64: string
  fileName?: string
}

export interface CheckerInput {
  userInput: string
  attachment?: CheckerAttachment
}

export interface CheckerModelOutput {
  scratchpad: string
  decision: 'Yes' | 'No'
  confidence: number
  concerns: string[]
  reasonCodes: string[]
  summary: string
}

export interface CheckerResponse {
  structuredData?: { type: 'checker'; data: CheckerModelOutput }
  webSources?: WebSource[]
  reply: string
}
