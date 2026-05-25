'use client'

import { useState } from 'react'
import { Sparkles, Ticket } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useAdvisorChat } from '../hooks/useAdvisorChat'
import { ChatPanel } from './ChatPanel'
import { TicketForm } from './TicketForm'
import { TicketList } from './TicketList'

type Tab = 'chat' | 'tickets'

export function AdvisorPage() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('chat')
  const [input, setInput] = useState('')
  const [ticketRefreshKey, setTicketRefreshKey] = useState(0)

  const { messages, isLoading, sendMessage, chatEndRef } = useAdvisorChat()

  const userInitial = (profile?.displayName ?? profile?.email ?? 'U')[0]!.toUpperCase()
  const userName = profile?.displayName?.split(' ')[0] ?? 'there'

  const handleTicketSuccess = () => setTicketRefreshKey((k) => k + 1)

  return (
    // -m-6 escapes the parent layout's p-6, h-[calc(100vh-64px)] fills the viewport below the topbar
    <div className="-m-6 flex h-[calc(100vh-64px)] flex-col bg-white">
      {/* Tab bar */}
      <div className="flex shrink-0 items-center border-b border-zinc-100 bg-white px-6">
        <div className="flex gap-0">
          <TabButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')}>
            <Sparkles className="size-3.5" />
            AI Advisor
          </TabButton>
          <TabButton active={activeTab === 'tickets'} onClick={() => setActiveTab('tickets')}>
            <Ticket className="size-3.5" />
            My Tickets
          </TabButton>
        </div>

        {activeTab === 'chat' && (
          <div className="ml-auto flex items-center gap-1.5 pr-1">
            <span className="block size-1.5 animate-pulse rounded-full bg-red-500" />
            <span className="text-xs text-zinc-400">Online</span>
          </div>
        )}
      </div>

      {/* Page content */}
      <div className="flex min-h-0 flex-1">
        {activeTab === 'chat' && (
          <ChatPanel
            messages={messages}
            isLoading={isLoading}
            input={input}
            onInputChange={setInput}
            onSend={sendMessage}
            chatEndRef={chatEndRef}
            userInitial={userInitial}
            userName={userName}
            onGoToTickets={() => setActiveTab('tickets')}
          />
        )}

        {activeTab === 'tickets' && (
          <div className="flex-1 overflow-y-auto bg-white">
            <div className="mx-auto max-w-5xl px-6 py-8">
              <div className="mb-6">
                <h1 className="text-lg font-semibold text-zinc-900">Support Tickets</h1>
                <p className="mt-1 text-sm text-zinc-500">
                  Submit a ticket to get a direct response from your Internship Coordinator.
                </p>
              </div>
              <div className="grid gap-6 lg:grid-cols-5">
                <div className="lg:col-span-2">
                  <TicketForm onSuccess={handleTicketSuccess} />
                </div>
                <div className="lg:col-span-3">
                  <TicketList refreshTrigger={ticketRefreshKey} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-3.5 text-sm font-medium transition-colors ${
        active
          ? 'border-red-700 text-red-700'
          : 'border-transparent text-zinc-400 hover:text-zinc-700'
      }`}
    >
      {children}
    </button>
  )
}
