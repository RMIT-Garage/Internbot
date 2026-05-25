'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Circle, Clock, CheckCircle, XCircle, Send, RotateCcw } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { TicketsService } from '@/lib/api/openapi-client'
import { TransitionTicketRequest } from '@/api/models/TransitionTicketRequest'
import type { TicketResponse } from '@/api/models/TicketResponse'
import type { TicketReplyResponse } from '@/api/models/TicketReplyResponse'
import { getApiErrorMessage } from '@/lib/api/errors'

const CATEGORY_LABELS: Record<string, string> = {
  eligibility: 'Eligibility',
  credit_points: 'Credit Points',
  self_sourcing: 'Self-Sourcing',
  careerhub: 'CareerHub',
  other: 'Other',
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  open: { label: 'Open', dot: 'bg-red-500', text: 'text-red-700' },
  in_progress: { label: 'In Progress', dot: 'bg-amber-400', text: 'text-amber-700' },
  resolved: { label: 'Resolved', dot: 'bg-green-500', text: 'text-green-700' },
  closed: { label: 'Closed', dot: 'bg-zinc-300', text: 'text-zinc-500' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ReplyBubble({ reply, isMine }: { reply: TicketReplyResponse; isMine: boolean }) {
  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 ${
          isMine
            ? 'rounded-tr-sm bg-zinc-900 text-white'
            : 'rounded-tl-sm border border-zinc-200 bg-white text-zinc-800'
        }`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{reply.text}</p>
        <p className={`mt-1.5 text-[11px] ${isMine ? 'text-zinc-400' : 'text-zinc-400'}`}>
          {reply.authorRole === 'coordinator' ? 'Coordinator' : 'You'} ·{' '}
          {formatDate(reply.createdAt)}
        </p>
      </div>
    </div>
  )
}

function TicketConversationContent() {
  const { user, loading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''

  const [ticket, setTicket] = useState<TicketResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)
  const [transitioning, setTransitioning] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (authLoading || !user || !id) return
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await TicketsService.getTicket(id)
        setTicket(data)
      } catch (err) {
        setError(getApiErrorMessage(err, 'Failed to load ticket'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [authLoading, user, id])

  useEffect(() => {
    if (!loading) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [loading, ticket?.replies.length])

  const handleReply = async () => {
    if (!replyText.trim() || !id) return
    setReplyError(null)
    setSubmitting(true)
    try {
      const reply = await TicketsService.postTicketReply(id, { text: replyText.trim() })
      setReplyText('')
      setTicket((t) => (t ? { ...t, replies: [...t.replies, reply] } : t))
    } catch (err) {
      setReplyError(getApiErrorMessage(err, 'Failed to send reply'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleReopen = async () => {
    if (!ticket) return
    setTransitioning(true)
    try {
      const updated = await TicketsService.transitionTicket(id, {
        to: TransitionTicketRequest.to.OPEN,
      })
      setTicket(updated)
    } catch {
      // silently fail — state is stale, user can refresh
    } finally {
      setTransitioning(false)
    }
  }

  if (!id) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        No ticket ID provided.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-32 animate-pulse rounded bg-zinc-100" />
        <div className="h-24 animate-pulse rounded-xl bg-zinc-100" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-zinc-100" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="space-y-4">
        <Link
          href="/student/advisor"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-700"
        >
          <ArrowLeft className="size-4" /> Back to Advisor
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? 'Ticket not found.'}
        </div>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG['open']!
  const canReopen = ticket.status === 'resolved' || ticket.status === 'closed'
  const canReply = ticket.status !== 'closed'

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/student/advisor"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-700"
      >
        <ArrowLeft className="size-4" /> Back to Advisor
      </Link>

      {/* Ticket header */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wide text-red-600 uppercase">Support Ticket</p>
            <h1 className="mt-1 text-lg font-bold text-zinc-900">{ticket.subject}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold ${statusCfg.text}`}
              >
                <span className={`size-1.5 rounded-full ${statusCfg.dot}`} />
                {statusCfg.label}
              </span>
              {ticket.category && (
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-500">
                  {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                </span>
              )}
            </div>
          </div>
          {canReopen && (
            <button
              type="button"
              onClick={handleReopen}
              disabled={transitioning}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
            >
              <RotateCcw className="size-3.5" />
              {transitioning ? 'Reopening…' : 'Re-open ticket'}
            </button>
          )}
        </div>
      </div>

      {/* Conversation thread */}
      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
        {/* Original message */}
        <div className="flex justify-end">
          <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-zinc-900 px-4 py-3 text-white">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{ticket.body}</p>
            <p className="mt-1.5 text-[11px] text-zinc-400">You · {formatDate(ticket.createdAt)}</p>
          </div>
        </div>

        {/* Replies */}
        {ticket.replies.map((reply) => (
          <ReplyBubble key={reply.id} reply={reply} isMine={reply.authorRole === 'student'} />
        ))}

        {ticket.replies.length === 0 && (
          <p className="py-4 text-center text-xs text-zinc-400">
            No replies yet. A coordinator will respond soon.
          </p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Reply form */}
      {canReply ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          {replyError && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {replyError}
            </div>
          )}
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            disabled={submitting}
            rows={3}
            placeholder="Type a reply…"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleReply()
            }}
            className="w-full resize-none rounded-xl border border-zinc-200 p-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 disabled:bg-zinc-50 disabled:text-zinc-400"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={handleReply}
              disabled={submitting || !replyText.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-40"
            >
              <Send className="size-3.5" />
              {submitting ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-center text-sm text-zinc-500">
          This ticket is closed. Re-open it to send a reply.
        </div>
      )}
    </div>
  )
}

export default function StudentTicketPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="h-5 w-32 animate-pulse rounded bg-zinc-100" />
          <div className="h-24 animate-pulse rounded-xl bg-zinc-100" />
        </div>
      }
    >
      <TicketConversationContent />
    </Suspense>
  )
}
