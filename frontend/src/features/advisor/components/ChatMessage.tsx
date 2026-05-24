'use client'

import { useState } from 'react'
import { Sparkles, ChevronDown, ChevronUp, Globe, BookOpen } from 'lucide-react'
import { MessageBodyRenderer } from './MessageBodyRenderer'
import type { Message } from '../types'

interface ChatMessageProps {
  message: Message
  userInitial: string
}

export function ChatMessage({ message, userInitial }: ChatMessageProps) {
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="flex max-w-[80%] items-end gap-2">
          <div className="rounded-2xl rounded-br-sm bg-zinc-900 px-4 py-2.5 text-sm leading-relaxed text-white">
            {message.content}
          </div>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">
            {userInitial}
          </div>
        </div>
      </div>
    )
  }

  const hasSources = (message.sources?.length ?? 0) > 0
  const hasWebSources = (message.webSources?.length ?? 0) > 0
  const totalSources = (message.sources?.length ?? 0) + (message.webSources?.length ?? 0)

  return (
    <div className="flex items-start gap-3">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-red-700 text-white">
        <Sparkles className="size-3.5" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="rounded-2xl rounded-tl-sm border border-zinc-100 bg-white px-4 py-3 shadow-sm">
          {message.isStreaming && !message.content ? (
            <div className="flex items-center gap-1 py-0.5">
              <span className="size-1.5 animate-bounce rounded-full bg-zinc-300" />
              <span
                className="size-1.5 animate-bounce rounded-full bg-zinc-300"
                style={{ animationDelay: '0.15s' }}
              />
              <span
                className="size-1.5 animate-bounce rounded-full bg-zinc-300"
                style={{ animationDelay: '0.3s' }}
              />
            </div>
          ) : (
            <MessageBodyRenderer
              content={message.content}
              contentType={message.contentType}
              contentBlocks={message.contentBlocks}
            />
          )}
        </div>

        {(hasSources || hasWebSources) && (
          <div className="overflow-hidden rounded-xl border border-zinc-100">
            <button
              onClick={() => setSourcesOpen((o) => !o)}
              className="flex w-full items-center justify-between px-3 py-2 text-xs text-zinc-400 transition hover:text-zinc-600"
            >
              <span className="flex items-center gap-1.5">
                <BookOpen className="size-3" />
                {totalSources} source{totalSources > 1 ? 's' : ''}
              </span>
              {sourcesOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>

            {sourcesOpen && (
              <div className="space-y-1.5 border-t border-zinc-100 bg-zinc-50 px-3 pt-2 pb-2.5">
                {message.sources?.map((s, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <BookOpen className="mt-0.5 size-3 shrink-0 text-zinc-300" />
                    {s.sourceUrl ? (
                      <a
                        href={s.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs leading-snug text-red-700 hover:underline"
                      >
                        {s.title} — {s.section}
                      </a>
                    ) : (
                      <span className="text-xs leading-snug text-zinc-500">
                        {s.title} — {s.section}
                      </span>
                    )}
                  </div>
                ))}
                {message.webSources?.map((s, i) => (
                  <div key={`w${i}`} className="flex items-start gap-1.5">
                    <Globe className="mt-0.5 size-3 shrink-0 text-zinc-300" />
                    <a
                      href={s.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs leading-snug text-red-700 hover:underline"
                    >
                      {s.title}
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
