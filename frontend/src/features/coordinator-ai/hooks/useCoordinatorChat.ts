'use client'

import { useRef, useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import { mapAssistantChatResponse } from '@/lib/chat/map-assistant-chat-response'
import type { ChatAttachment, CoordinatorChatResponse, CoordinatorMessage } from '../types'

const INITIAL_MESSAGE: CoordinatorMessage = {
  id: 'init',
  role: 'assistant',
  content:
    'Welcome, Coordinator. Ask me anything about RMIT internship policy, award classification, supervision requirements, or review criteria.',
  contentType: 'plain',
}

export function useCoordinatorChat() {
  const [messages, setMessages] = useState<CoordinatorMessage[]>([INITIAL_MESSAGE])
  const [isLoading, setIsLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const sendMessage = async (text: string, attachment?: ChatAttachment) => {
    if (!text.trim() || isLoading) return

    const userMsg: CoordinatorMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      attachmentName: attachment?.fileName,
    }
    const assistantId = crypto.randomUUID()
    const assistantMsg: CoordinatorMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setIsLoading(true)
    setTimeout(scrollToBottom, 50)

    try {
      const data = await apiFetch<CoordinatorChatResponse>('/api/v1/coordinator/ai/chat', {
        method: 'POST',
        body: attachment ? { userInput: text, attachment } : { userInput: text },
      })

      const mapped = mapAssistantChatResponse(data)

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: mapped.content,
                contentType: mapped.contentType,
                contentBlocks: mapped.contentBlocks,
                sources: data.sources,
                webSources: data.webSources,
                isStreaming: false,
              }
            : m
        )
      )
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: "Sorry, I couldn't reach the advisor service. Please try again.",
                isStreaming: false,
              }
            : m
        )
      )
    } finally {
      setIsLoading(false)
      setTimeout(scrollToBottom, 50)
    }
  }

  const clearMessages = () => setMessages([INITIAL_MESSAGE])

  return { messages, isLoading, sendMessage, clearMessages, chatEndRef }
}
