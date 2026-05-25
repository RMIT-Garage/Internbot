'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useCoordinatorChat } from '../hooks/useCoordinatorChat'
import { CoordinatorChatPanel } from './CoordinatorChatPanel'

export function CoordinatorAssistantPage() {
  const { profile } = useAuth()
  const [input, setInput] = useState('')

  const { messages, isLoading, sendMessage, chatEndRef } = useCoordinatorChat()

  const userInitial = (profile?.displayName ?? profile?.email ?? 'C')[0]!.toUpperCase()
  const userName = profile?.displayName?.split(' ')[0] ?? 'Coordinator'

  return (
    <div className="-m-6 flex h-[calc(100vh-64px)] flex-col bg-white">
      {/* Header bar */}
      <div className="flex shrink-0 items-center border-b border-zinc-100 bg-white px-6">
        <div className="flex items-center gap-1.5 border-b-2 border-red-700 px-4 py-3.5 text-sm font-medium text-red-700">
          <Sparkles className="size-3.5" />
          AI Assistant
        </div>

        <div className="ml-auto flex items-center gap-1.5 pr-1">
          <span className="block size-1.5 animate-pulse rounded-full bg-red-500" />
          <span className="text-xs text-zinc-400">Online</span>
        </div>
      </div>

      {/* Chat */}
      <div className="flex min-h-0 flex-1">
        <CoordinatorChatPanel
          messages={messages}
          isLoading={isLoading}
          input={input}
          onInputChange={setInput}
          onSend={sendMessage}
          chatEndRef={chatEndRef}
          userInitial={userInitial}
          userName={userName}
        />
      </div>
    </div>
  )
}
