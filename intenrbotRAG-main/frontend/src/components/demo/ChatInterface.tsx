'use client'

import { useEffect, useRef, useState } from 'react'
import { Globe, Sparkles } from 'lucide-react'
import { ChatInputArea } from './ChatInputArea'
import {
  AssistantMessage,
  type StructuredChatData,
  type RagSource,
  type WebSource,
} from './AssistantMessage'
import type { MessageContentBlock } from './MessageBodyRenderer'
import { toast } from 'sonner'

export type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  contentType?: 'plain' | 'markdown' | 'structured'
  contentVersion?: 'v1'
  contentBlocks?: MessageContentBlock[]
  fileAttached?: boolean
  structuredData?: StructuredChatData
  sources?: RagSource[]
  webSources?: WebSource[]
}

interface ChatInterfaceProps {
  feature: string
}

function isDeprecatedModel(model: string): boolean {
  return model.startsWith('gemini-2.0-')
}

function isWebSearchModelSupported(model: string): boolean {
  return model.startsWith('gemini-') && !isDeprecatedModel(model)
}

export function ChatInterface({ feature }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash')
  const [useWebSearch, setUseWebSearch] = useState<boolean>(feature === 'faq-rag')
  const scrollRef = useRef<HTMLDivElement>(null)
  const sanitizedAvailableModels = availableModels.filter((model) => !isDeprecatedModel(model))
  const compatibleWebSearchModels = sanitizedAvailableModels.filter((model) =>
    isWebSearchModelSupported(model)
  )

  useEffect(() => {
    // Scroll to bottom whenever messages change
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    setMessages([])
  }, [feature])

  useEffect(() => {
    setUseWebSearch(feature === 'faq-rag')
  }, [feature])

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('chatModel') : null
    if (saved) {
      const normalizedSaved = isDeprecatedModel(saved) ? 'gemini-2.5-flash' : saved
      setSelectedModel(normalizedSaved)
      if (typeof window !== 'undefined' && normalizedSaved !== saved) {
        window.localStorage.setItem('chatModel', normalizedSaved)
      }
    }
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const response = await fetch('/api/backend/chat/models', {
          headers: { Authorization: 'Bearer no-token' },
        })
        if (!response.ok) return
        const data = (await response.json()) as { models?: string[] }
        const models = (Array.isArray(data.models) ? data.models : []).filter(
          (model) => !isDeprecatedModel(model)
        )
        if (!active || models.length === 0) return
        setAvailableModels(models)
        if (!models.includes(selectedModel)) {
          const fallback = models.includes('gemini-2.5-flash') ? 'gemini-2.5-flash' : models[0]!
          setSelectedModel(fallback)
          if (typeof window !== 'undefined') window.localStorage.setItem('chatModel', fallback)
        }
      } catch {
        // Keep current model and continue.
      }
    })()

    return () => {
      active = false
    }
  }, [selectedModel])

  useEffect(() => {
    if (!useWebSearch || feature !== 'faq-rag') return
    if (isWebSearchModelSupported(selectedModel)) return

    const fallbackModel = compatibleWebSearchModels[0]
    if (fallbackModel) {
      setSelectedModel(fallbackModel)
      if (typeof window !== 'undefined') window.localStorage.setItem('chatModel', fallbackModel)
      toast.info(`Switched to ${fallbackModel} because web search requires a Gemini model.`)
    }
  }, [feature, selectedModel, useWebSearch, compatibleWebSearchModels])

  const handleSend = async (
    messageText: string,
    fileContext?: string,
    attachment?: { mimeType: string; dataBase64: string; fileName?: string }
  ) => {
    const newMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText || '(Sent a file)',
      fileAttached: !!fileContext || !!attachment,
    }

    setMessages((prev) => [...prev, newMsg])
    setIsTyping(true)

    try {
      // Route through the Next.js server-side proxy to avoid CORS issues with
      // the Firebase Emulator (emulator doesn't add CORS headers to preflight responses).
      const response = await fetch(`/api/backend/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer no-token',
        },
        body: JSON.stringify({
          feature,
          userInput: messageText || '[File uploaded]',
          fileContext,
          attachment,
          model:
            feature === 'faq-rag' && useWebSearch && !isWebSearchModelSupported(selectedModel)
              ? (compatibleWebSearchModels[0] ?? selectedModel)
              : selectedModel,
          useWebSearch: feature === 'faq-rag' ? useWebSearch : false,
        }),
      })

      if (!response.ok) {
        let detail = `Request failed (${response.status})`
        try {
          const err = (await response.json()) as { detail?: string }
          if (err?.detail) detail = err.detail
        } catch {
          // Keep fallback detail if response is not JSON.
        }
        throw new Error(detail)
      }

      const data = await response.json()

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply || '(No response text)',
        contentType:
          data.contentType === 'plain' ||
          data.contentType === 'markdown' ||
          data.contentType === 'structured'
            ? data.contentType
            : undefined,
        contentVersion: data.contentVersion === 'v1' ? 'v1' : undefined,
        contentBlocks: Array.isArray(data.contentBlocks) ? data.contentBlocks : undefined,
        structuredData: data.structuredData ?? undefined,
        sources: Array.isArray(data.sources) ? data.sources : undefined,
        webSources: Array.isArray(data.webSources) ? data.webSources : undefined,
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (error) {
      if (
        error instanceof Error &&
        /no longer available|NOT_FOUND|models\/gemini-2\.0-/i.test(error.message)
      ) {
        const fallback = compatibleWebSearchModels[0] ?? 'gemini-2.5-flash'
        setSelectedModel(fallback)
        if (typeof window !== 'undefined') window.localStorage.setItem('chatModel', fallback)
        toast.error(`Selected model is unavailable. Switched to ${fallback}.`)
        return
      }
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'The server encountered an error fulfilling the chat request.'
      if (/Invalid request payload/i.test(message) && (fileContext || attachment)) {
        toast.error(
          'Attachment could not be processed. Try a smaller plain-text file or shorten the content.'
        )
      } else {
        toast.error(message)
      }
    } finally {
      setIsTyping(false)
    }
  }

  // Feature specific colors and copy
  let emptyTitle = ''
  if (feature === 'contract-checker') emptyTitle = 'Contract Checker'
  else if (feature === 'job-checker') emptyTitle = 'Job Checker'
  else if (feature === 'faq-rag') emptyTitle = 'FAQ Assistant'
  else emptyTitle = 'Assistant'

  const quickPrompts: Record<string, string[]> = {
    'faq-rag': [
      'Summarize internship attendance requirements.',
      'What documents are mandatory before placement starts?',
      'List key escalation points for coordinators.',
    ],
    'contract-checker': [
      'Check this contract for unpaid overtime risk.',
      'Highlight clauses that conflict with policy.',
      'What should a coordinator verify first?',
    ],
    'job-checker': [
      'Does this role meet placement eligibility?',
      'Which responsibilities raise compliance concerns?',
      'Provide a quick pass/fail checklist.',
    ],
  }
  const promptSuggestions = quickPrompts[feature] ?? quickPrompts['faq-rag'] ?? []

  return (
    <div className="bg-background flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5" ref={scrollRef}>
        <div className="mx-auto mb-3 flex w-full max-w-4xl flex-wrap justify-end gap-2">
          {feature === 'faq-rag' ? (
            <div className="inline-flex flex-col gap-1">
              <label className="bg-surface inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs text-zinc-600 shadow-sm">
                <Globe className="size-3.5 text-zinc-500" />
                Search the web
                <input
                  type="checkbox"
                  checked={useWebSearch}
                  onChange={(e) => setUseWebSearch(e.target.checked)}
                  className="accent-brand-500 h-4 w-4"
                />
              </label>
              {useWebSearch && !isWebSearchModelSupported(selectedModel) ? (
                <p className="text-[11px] text-amber-600">
                  Web search not supported for current model. Select a Gemini model.
                </p>
              ) : null}
              {useWebSearch && isWebSearchModelSupported(selectedModel) ? (
                <p className="text-[11px] text-zinc-500">
                  Web search enabled via Gemini grounding.
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="bg-surface inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 shadow-sm">
            <div className="bg-brand-50 text-brand-900 flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold uppercase tracking-wide">
              <Sparkles className="size-3" />
              Model
            </div>
            <div className="relative">
              <select
                value={selectedModel}
                onChange={(e) => {
                  const nextModel = e.target.value
                  setSelectedModel(nextModel)
                  if (typeof window !== 'undefined') {
                    window.localStorage.setItem('chatModel', nextModel)
                  }
                }}
                className="bg-background focus:ring-brand-500/25 min-w-52 appearance-none rounded-lg border py-1.5 pl-3 pr-8 text-xs font-medium text-zinc-700 focus:outline-none focus:ring-2"
                aria-label="Select chat model"
              >
                {(sanitizedAvailableModels.length > 0
                  ? sanitizedAvailableModels
                  : [selectedModel]
                ).map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-zinc-400">
                ▾
              </span>
            </div>
          </div>
        </div>
        {messages.length === 0 ? (
          <div className="bg-surface mx-auto w-full max-w-4xl rounded-2xl border p-6 sm:p-8">
            <div className="flex items-start gap-3">
              <div className="bg-brand-50 text-brand-900 flex h-12 w-12 items-center justify-center rounded-xl text-sm font-semibold">
                AI
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {emptyTitle}
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-zinc-500">
                  Ask a question, attach context, or run a checker flow. Responses prioritize
                  grounded, policy-aware guidance.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {promptSuggestions.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  className="bg-background hover:border-brand-100 hover:bg-brand-50/40 rounded-xl border px-3 py-2 text-left text-xs text-zinc-600 hover:text-zinc-900"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-4xl space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'user' ? (
                  <div className="border-brand-100 bg-brand-50 text-brand-900 dark:border-brand-100 dark:bg-brand-50/35 dark:text-brand-900 max-w-[85%] rounded-2xl rounded-tr-sm border px-4 py-3 shadow-sm">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                    {msg.fileAttached && (
                      <div className="text-brand-900 mt-2 w-fit rounded-md bg-white/70 px-2 py-1 text-xs dark:bg-zinc-950">
                        📎 Document attached
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-surface w-full max-w-[92%] rounded-2xl rounded-tl-sm border border-zinc-200 px-4 py-3 text-zinc-800 shadow-sm dark:border-zinc-700 dark:text-zinc-100">
                    <AssistantMessage
                      messageId={msg.id}
                      content={msg.content}
                      contentType={msg.contentType}
                      contentBlocks={msg.contentBlocks}
                      structuredData={msg.structuredData}
                      sources={msg.sources}
                      webSources={msg.webSources}
                    />
                  </div>
                )}
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-surface flex items-center gap-1 rounded-2xl rounded-tl-sm border px-5 py-4 shadow-sm">
                  <span className="bg-brand-500 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.3s]"></span>
                  <span className="bg-brand-500 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.15s]"></span>
                  <span className="bg-brand-500 h-1.5 w-1.5 animate-bounce rounded-full"></span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-4xl">
        <ChatInputArea onSend={handleSend} disabled={isTyping} />
      </div>
    </div>
  )
}
