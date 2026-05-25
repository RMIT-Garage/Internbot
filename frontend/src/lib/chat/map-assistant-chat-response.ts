import { sanitizeChatContent } from './sanitize-chat-content'
import type { ContentBlock } from '@/components/shared/MessageBodyRenderer'

interface AssistantChatPayload {
  reply: string
  contentType?: 'plain' | 'markdown' | 'structured'
  contentBlocks?: ContentBlock[]
}

export function mapAssistantChatResponse(data: AssistantChatPayload): {
  content: string
  contentType: 'plain' | 'markdown' | 'structured'
  contentBlocks?: ContentBlock[]
} {
  const sanitized = sanitizeChatContent(data.reply, data.contentType)
  return {
    content: sanitized.content,
    contentType: sanitized.contentType,
    contentBlocks: sanitized.extractedFaq ? undefined : data.contentBlocks,
  }
}
