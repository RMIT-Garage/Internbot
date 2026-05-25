'use client'

import { useRef, useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import type { CoordinatorChatResponse, CoordinatorMessage } from '../types'

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

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMsg: CoordinatorMessage = { id: crypto.randomUUID(), role: 'user', content: text }
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
        body: { userInput: text },
      })

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: data.reply,
                contentType: data.contentType ?? 'plain',
                contentBlocks: data.contentBlocks,
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

  return { messages, isLoading, sendMessage, chatEndRef }
}
