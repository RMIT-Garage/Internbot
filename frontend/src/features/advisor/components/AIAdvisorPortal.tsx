'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Wand2,
  Settings,
  MessageSquare,
  Send,
  Paperclip,
  Info,
  CheckCircle,
  CreditCard,
  LifeBuoy,
  Zap,
} from 'lucide-react'
import { apiFetch } from '@/lib/api/client'
import { useUserProfile } from '@/features/profile/hooks/useUserProfile'

// ── Types ──────────────────────────────────────────────────────

type Role = 'user' | 'assistant'

interface Message {
  id: string
  role: Role
  content: string
  isStreaming?: boolean
}

const TICKET_CATEGORIES = ['Eligibility', 'Credit Points', 'Self-Sourcing', 'CareerHub', 'Other']

const SUGGESTION_CHIPS = ['Check Eligibility', 'Credit Point Rules', 'Self-Sourcing Guide']

const FAQ_ITEMS = [
  {
    icon: <CheckCircle size={16} className="text-indigo-500" />,
    title: 'Eligibility Requirements',
    sub: 'Am I qualified to start an internship this year?',
    prompt: 'What are the eligibility requirements to start an internship?',
  },
  {
    icon: <CreditCard size={16} className="text-blue-500" />,
    title: 'Credit Points',
    sub: 'How many credits is a 3-month placement...',
    prompt: 'How many credit points does a 3-month internship placement earn?',
  },
  {
    icon: <Wand2 size={16} className="text-red-500" />,
    title: 'Self-Sourcing Steps',
    sub: 'Steps for finding your own workplace...',
    prompt: 'What are the steps to get a self-sourced internship approved?',
  },
  {
    icon: <Settings size={16} className="text-gray-400" />,
    title: 'CareerHub FAQ',
    sub: 'Troubleshooting CareerHub portal logins.',
    prompt: 'How do I fix login issues with the CareerHub portal?',
  },
]

const INITIAL_MESSAGE: Message = {
  id: 'init',
  role: 'assistant',
  content:
    "Welcome back! I'm your AI Internship Advisor. I can help you find eligibility requirements, explain the self-sourcing process, or check your credit point status. How can I assist your academic journey today?",
}

// ── Main Component ─────────────────────────────────────────────

export function AIAdvisorPortal() {
  const router = useRouter()
  const { user } = useUserProfile()
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Ticket form state
  const [ticketSubject, setTicketSubject] = useState('')
  const [ticketCategory, setTicketCategory] = useState(TICKET_CATEGORIES[0]!)
  const [ticketBody, setTicketBody] = useState('')
  const [submittingTicket, setSubmittingTicket] = useState(false)

  // useEffect(() => {
  //   chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  // }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return
    setInput('')

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
    const assistantId = crypto.randomUUID()
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setIsLoading(true)

    try {
      // Build conversation history for the API
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `You are Internbot Advisor, an AI assistant helping RMIT students navigate their internship process. 
You help with: eligibility requirements, credit point calculations, self-sourcing steps, CareerHub issues, and semester deadlines.
The student's name is ${user?.displayName ?? 'the student'}.
Keep responses concise, structured, and specific to RMIT internship processes.
Do not invent specific policy details you are unsure about — tell the student to confirm with their coordinator.`,
          messages: history,
        }),
      })

      if (!response.ok) throw new Error('Failed to get advisor response')

      const data = await response.json()
      const content = data.content?.[0]?.text ?? 'Sorry, I could not generate a response.'

      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content, isStreaming: false } : m))
      )
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: 'Sorry, something went wrong. Please try again.',
                isStreaming: false,
              }
            : m
        )
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmitTicket = async () => {
    if (!ticketSubject.trim() || !ticketBody.trim()) {
      toast.error('Please fill in both subject and message.')
      return
    }

    setSubmittingTicket(true)
    try {
      await apiFetch('/api/v1/tickets', {
        method: 'POST',
        body: JSON.stringify({
          subject: ticketSubject,
          body: ticketBody,
          category: ticketCategory.toLowerCase(),
        }),
      })
      toast.success('Ticket submitted! An administrator will respond shortly.')
      setTicketSubject('')
      setTicketBody('')
      setTicketCategory(TICKET_CATEGORIES[0]!)
    } catch {
      toast.error('Failed to submit ticket. Please try again.')
    } finally {
      setSubmittingTicket(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-[#F9FAFB] font-sans text-slate-800">
      {/* Main */}
      <div className="flex flex-1 flex-col">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-12 gap-8 p-10">
          {/* Chat (8 cols) */}
          <div className="col-span-8 flex h-[calc(100vh-160px)] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            {/* Chat header */}
            <div className="flex items-center justify-between border-b border-gray-50 p-6">
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-red-600 p-2.5 shadow-lg shadow-red-100">
                  <Wand2 size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Internbot Advisor</h3>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                    <span className="text-[10px] font-bold tracking-widest text-green-600 uppercase">
                      Always online for RMIT Students
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex max-w-xs gap-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
                <Info size={16} className="mt-0.5 shrink-0 text-blue-600" />
                <div>
                  <p className="mb-0.5 text-[9px] font-black tracking-tight text-blue-800 uppercase">
                    Advisory Note
                  </p>
                  <p className="text-[10px] leading-tight text-blue-700">
                    AI answers are advisory. They do not replace final Internship Coordinator
                    decisions.
                  </p>
                </div>
              </div>
            </div>

            {/* Chat body */}
            <div className="flex-1 space-y-8 overflow-y-auto bg-gray-50/30 p-8">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}

              {/* Suggestion chips after initial message */}
              {messages.length === 1 && (
                <div className="flex flex-wrap gap-2 pl-12">
                  {SUGGESTION_CHIPS.map((label) => (
                    <SuggestionChip key={label} label={label} onClick={() => sendMessage(label)} />
                  ))}
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            <div className="border-t border-gray-100 bg-white p-6">
              <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-2 pr-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage(input)
                    }
                  }}
                  placeholder="Ask about credits, deadlines, or sourcing..."
                  className="flex-1 bg-transparent px-4 py-2 text-sm outline-none"
                  disabled={isLoading}
                />
                <button className="p-2 text-gray-400 transition hover:text-slate-600">
                  <Paperclip size={20} />
                </button>
                <button
                  onClick={() => sendMessage(input)}
                  disabled={isLoading || !input.trim()}
                  className="flex items-center gap-2 rounded-lg bg-red-700 px-5 py-2.5 text-xs font-black tracking-widest text-white uppercase shadow-lg shadow-red-100 transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Send <Send size={14} />
                </button>
              </div>
              <p className="mt-4 text-center text-[9px] font-bold tracking-widest text-gray-300 uppercase">
                Powered by RMIT Academic Intelligence
              </p>
            </div>
          </div>

          {/* Right sidebar (4 cols) */}
          <div className="col-span-4 space-y-6">
            {/* Popular Questions */}
            <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
              <h3 className="mb-8 text-xs font-black tracking-[0.15em] text-slate-800 uppercase">
                Popular Questions
              </h3>
              <div className="space-y-6">
                {FAQ_ITEMS.map((item) => (
                  <FAQItem
                    key={item.title}
                    icon={item.icon}
                    title={item.title}
                    sub={item.sub}
                    onClick={() => sendMessage(item.prompt)}
                  />
                ))}
              </div>
            </div>

            {/* Support Ticket */}
            <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-lg bg-red-50 p-2 text-red-600">
                  <LifeBuoy size={20} />
                </div>
                <h3 className="text-xs font-black tracking-[0.15em] uppercase">Support Ticket</h3>
              </div>
              <p className="mb-6 text-[11px] leading-relaxed text-slate-500">
                AI couldn&apos;t help? Submit a ticket to an Academic Administrator for a direct
                human response.
              </p>

              <div className="mb-6 space-y-4">
                <div>
                  <label className="mb-2 block text-[10px] font-bold text-gray-400 uppercase">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    placeholder="e.g. Credit mismatch"
                    className="w-full rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-xs outline-none focus:border-red-300"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-bold text-gray-400 uppercase">
                    Category
                  </label>
                  <select
                    value={ticketCategory}
                    onChange={(e) => setTicketCategory(e.target.value)}
                    className="w-full cursor-pointer rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-slate-600 outline-none focus:border-red-300"
                  >
                    {TICKET_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-bold text-gray-400 uppercase">
                    Message
                  </label>
                  <textarea
                    value={ticketBody}
                    onChange={(e) => setTicketBody(e.target.value)}
                    placeholder="Provide details about your query..."
                    className="h-24 w-full resize-none rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-xs outline-none focus:border-red-300"
                  />
                </div>
              </div>

              <button
                onClick={handleSubmitTicket}
                disabled={submittingTicket}
                className="w-full rounded-xl bg-red-700 py-4 text-xs font-black tracking-widest text-white uppercase shadow-lg shadow-red-100 transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submittingTicket ? 'Submitting…' : 'Submit Ticket'}
              </button>
            </div>

            {/* Need Human Help */}
            {/* <div className="relative overflow-hidden rounded-2xl bg-slate-900 p-8 text-white">
              <h4 className="mb-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                Need Human Help?
              </h4>
              <p className="relative z-10 mb-6 text-xs leading-relaxed font-medium opacity-90">
                Book a 1-on-1 session with your Program Coordinator.
              </p>
              <button className="relative z-10 w-full rounded-xl bg-red-700 py-4 text-xs font-black tracking-widest uppercase transition hover:bg-red-800">
                Book Consultation
              </button>
              <MessageSquare
                size={120}
                className="absolute -right-10 -bottom-10 text-white opacity-[0.03]"
              />
            </div> */}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Helper components ──────────────────────────────────────────

function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="ml-auto flex max-w-[85%] flex-row-reverse gap-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
          U
        </div>
        <div className="rounded-2xl rounded-tr-none bg-slate-900 p-5 text-sm leading-relaxed text-white shadow-md">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex max-w-[85%] gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white">
        <Zap size={16} />
      </div>
      <div className="rounded-2xl rounded-tl-none border border-gray-100 bg-white p-5 text-sm leading-relaxed text-slate-700 shadow-sm">
        {message.isStreaming && !message.content ? (
          <div className="flex gap-1">
            <span className="animate-bounce">●</span>
            <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>
              ●
            </span>
            <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>
              ●
            </span>
          </div>
        ) : (
          <p className="whitespace-pre-line">{message.content}</p>
        )}
      </div>
    </div>
  )
}

function NavItem({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 transition-all ${
        active
          ? 'bg-red-50 font-bold text-red-700'
          : 'text-gray-400 hover:bg-gray-50 hover:text-slate-600'
      }`}
    >
      {icon}
      <span className="text-[13px]">{label}</span>
    </div>
  )
}

function SuggestionChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg bg-gray-100 px-4 py-2 text-[11px] font-bold text-slate-700 transition-colors hover:bg-gray-200"
    >
      {label}
    </button>
  )
}

function FAQItem({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  sub: string
  onClick: () => void
}) {
  return (
    <div onClick={onClick} className="group flex cursor-pointer gap-4">
      <div className="shrink-0 rounded-xl border border-transparent bg-gray-50 p-2.5 transition-all group-hover:border-gray-50 group-hover:bg-white group-hover:shadow-md">
        {icon}
      </div>
      <div className="flex flex-col justify-center">
        <h5 className="mb-0.5 text-xs leading-tight font-black text-slate-800">{title}</h5>
        <p className="text-[10px] font-medium text-gray-400">{sub}</p>
      </div>
    </div>
  )
}
