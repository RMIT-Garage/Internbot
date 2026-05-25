'use client'

import { useRef, useState } from 'react'
import {
  ArrowUp,
  GraduationCap,
  BookOpen,
  Sparkles,
  HelpCircle,
  Ticket,
  Paperclip,
  X,
} from 'lucide-react'
import { ChatMessage } from './ChatMessage'
import type { ChatAttachment, Message } from '../types'

const MAX_ATTACHMENT_BYTES = 1_500_000

const PROMPT_CARDS = [
  {
    icon: GraduationCap,
    label: 'Eligibility',
    description: 'Am I eligible to start an internship this semester?',
    prompt: 'What are the eligibility requirements to start an internship?',
  },
  {
    icon: BookOpen,
    label: 'Credit Points',
    description: 'How are credit points calculated for placements?',
    prompt: 'How do credit points work for a 3-month internship?',
  },
  {
    icon: Sparkles,
    label: 'Self-Sourcing',
    description: 'Steps to get a self-found workplace approved',
    prompt: 'What are the steps to get a self-sourced internship approved?',
  },
  {
    icon: HelpCircle,
    label: 'CareerHub',
    description: 'Trouble logging in or finding listings on CareerHub',
    prompt: 'How do I fix login issues with the CareerHub portal?',
  },
]

interface ChatPanelProps {
  messages: Message[]
  isLoading: boolean
  input: string
  onInputChange: (value: string) => void
  onSend: (text: string, attachment?: ChatAttachment) => void
  chatEndRef: React.RefObject<HTMLDivElement | null>
  userInitial: string
  userName: string
  onGoToTickets: () => void
}

export function ChatPanel({
  messages,
  isLoading,
  input,
  onInputChange,
  onSend,
  chatEndRef,
  userInitial,
  userName,
  onGoToTickets,
}: ChatPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingAttachment, setPendingAttachment] = useState<ChatAttachment | null>(null)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const isWelcome = messages.length === 1

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    onSend(input, pendingAttachment ?? undefined)
    onInputChange('')
    setPendingAttachment(null)
    setAttachmentError(null)
    inputRef.current?.focus()
  }

  const handleCard = (prompt: string) => {
    onSend(prompt)
    inputRef.current?.focus()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachmentError(
        `File too large (max 1.5 MB). "${file.name}" is ${(file.size / 1_000_000).toFixed(1)} MB.`
      )
      return
    }

    setAttachmentError(null)
    const dataBase64 = await fileToBase64(file)
    setPendingAttachment({
      mimeType: file.type || 'application/octet-stream',
      dataBase64,
      fileName: file.name,
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      {/* Scrollable area */}
      <div className="flex-1 overflow-y-auto">
        {isWelcome ? (
          <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-14 text-center">
            <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-red-700 shadow-md">
              <Sparkles className="size-6 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-zinc-900">
              Hi {userName}, I&apos;m your Internship Advisor
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Grounded in RMIT internship policy — ask me about eligibility, credits, self-sourcing,
              or CareerHub.
            </p>

            <div className="mt-8 grid w-full grid-cols-2 gap-2.5">
              {PROMPT_CARDS.map((card) => {
                const Icon = card.icon
                return (
                  <button
                    key={card.label}
                    onClick={() => handleCard(card.prompt)}
                    className="group flex flex-col items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-left transition hover:border-zinc-900 hover:shadow-sm"
                  >
                    <div className="rounded-lg bg-zinc-100 p-2 transition group-hover:bg-zinc-900">
                      <Icon className="size-4 text-zinc-500 transition group-hover:text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-800">{card.label}</p>
                      <p className="mt-0.5 text-xs text-zinc-400">{card.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            <p className="mt-8 text-xs text-zinc-400">
              AI answers are for guidance only and do not replace decisions from your coordinator.{' '}
              <button
                onClick={onGoToTickets}
                className="text-zinc-900 underline underline-offset-2 hover:text-red-700"
              >
                Submit a ticket
              </button>{' '}
              for a human response.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-5 px-6 py-6">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} userInitial={userInitial} />
            ))}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-zinc-100 bg-white px-6 py-4">
        <div className="mx-auto max-w-2xl">
          {/* Pending attachment pill */}
          {pendingAttachment && (
            <div className="mb-2 flex items-center gap-1.5">
              <div className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 py-1">
                <Paperclip className="size-3 shrink-0 text-zinc-500" />
                <span className="max-w-[240px] truncate text-xs text-zinc-600">
                  {pendingAttachment.fileName}
                </span>
                <button
                  onClick={() => setPendingAttachment(null)}
                  aria-label="Remove attachment"
                  className="ml-0.5 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="size-3" />
                </button>
              </div>
            </div>
          )}
          {/* Size error */}
          {attachmentError && <p className="mb-2 text-xs text-red-700">{attachmentError}</p>}

          <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 shadow-sm transition focus-within:border-zinc-400 focus-within:shadow-md hover:shadow-md">
            {/* Attach button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              aria-label="Attach file"
              className="flex size-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Paperclip className="size-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/*,.doc,.docx"
              className="hidden"
              onChange={handleFileChange}
            />

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your internship…"
              className="flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              aria-label="Send message"
              className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-red-700 text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-center gap-3">
            <span className="text-[10px] text-zinc-300">Powered by RMIT Policy Knowledge Base</span>
            <span className="text-[10px] text-zinc-200">·</span>
            <button
              onClick={onGoToTickets}
              className="inline-flex items-center gap-1 text-[10px] text-zinc-400 transition hover:text-zinc-600"
            >
              <Ticket className="size-3" />
              Submit a ticket
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      if (base64) resolve(base64)
      else reject(new Error('Failed to read file'))
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
