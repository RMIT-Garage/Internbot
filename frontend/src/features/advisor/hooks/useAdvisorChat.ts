'use client'

import { useRef, useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import { mapAssistantChatResponse } from '@/lib/chat/map-assistant-chat-response'
import type { AdvisorChatResponse, ChatAttachment, Message } from '../types'

const INITIAL_MESSAGE: Message = {
  id: 'init',
  role: 'assistant',
  content:
    "Welcome! I'm your AI Internship Advisor, powered by RMIT's policy knowledge base. Ask me about eligibility requirements, credit points, self-sourcing steps, or CareerHub issues.",
  contentType: 'plain',
}

export function useAdvisorChat() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [isLoading, setIsLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const sendMessage = async (text: string, attachment?: ChatAttachment) => {
    if (!text.trim() || isLoading) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      attachmentName: attachment?.fileName,
    }
    const assistantId = crypto.randomUUID()
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setIsLoading(true)

    setTimeout(scrollToBottom, 50)

    try {
      const data = await apiFetch<AdvisorChatResponse>('/api/v1/advisor/chat', {
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

  return { messages, isLoading, sendMessage, chatEndRef }
}
