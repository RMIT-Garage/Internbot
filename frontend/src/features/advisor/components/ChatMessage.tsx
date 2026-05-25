'use client'

import { Sparkles, Paperclip } from 'lucide-react'
import { MessageBodyRenderer } from '@/components/shared/MessageBodyRenderer'
import { ChatSourcesPanel } from '@/components/shared/ChatSourcesPanel'
import type { Message } from '../types'

interface ChatMessageProps {
  message: Message
  userInitial: string
}

export function ChatMessage({ message, userInitial }: ChatMessageProps) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="flex max-w-[80%] items-end gap-2">
          <div className="rounded-2xl rounded-br-sm bg-zinc-900 px-4 py-2.5 text-sm leading-relaxed text-white">
            {message.content}
            {message.attachmentName && (
              <div className="mt-1.5 flex items-center gap-1 text-xs text-zinc-400">
                <Paperclip className="size-3 shrink-0" />
                <span className="max-w-[200px] truncate">{message.attachmentName}</span>
              </div>
            )}
          </div>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">
            {userInitial}
          </div>
        </div>
      </div>
    )
  }

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

        <ChatSourcesPanel
          messageId={message.id}
          sources={message.sources}
          webSources={message.webSources}
        />
      </div>
    </div>
  )
}
