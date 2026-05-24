import type { ContentBlock } from './components/MessageBodyRenderer'

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

export interface Message {
  id: string
  role: MessageRole
  content: string
  contentType?: 'plain' | 'markdown' | 'structured'
  contentBlocks?: ContentBlock[]
  sources?: ChatSource[]
  webSources?: WebSource[]
  isStreaming?: boolean
}

export interface AdvisorChatResponse {
  reply: string
  contentType?: 'plain' | 'markdown' | 'structured'
  contentBlocks?: ContentBlock[]
  sources: ChatSource[]
  webSources?: WebSource[]
}
