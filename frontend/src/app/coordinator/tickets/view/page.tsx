'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Send, User, AlertCircle } from 'lucide-react'
import CoordinatorContentSkeleton from '@/components/coordinator/CoordinatorContentSkeleton'
import { apiFetch } from '@/lib/api/client'
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

const STATUS_CONFIG: Record<string, { label: string; dot: string; pill: string }> = {
  open: {
    label: 'Open',
    dot: 'bg-red-600',
    pill: 'bg-red-600 text-white',
  },
  in_progress: {
    label: 'In Progress',
    dot: 'bg-red-400',
    pill: 'bg-red-100 text-red-700',
  },
  resolved: {
    label: 'Resolved',
    dot: 'bg-black',
    pill: 'bg-black text-white',
  },
  closed: {
    label: 'Closed',
    dot: 'bg-black/20',
    pill: 'bg-black/10 text-black/50',
  },
}

const TRANSITIONS: Record<
  string,
  Array<{ to: TransitionTicketRequest.to; label: string; style: string }>
> = {
  open: [
    {
      to: TransitionTicketRequest.to.IN_PROGRESS,
      label: 'Start Reviewing',
      style: 'bg-black text-white hover:bg-black/80',
    },
    {
      to: TransitionTicketRequest.to.CLOSED,
      label: 'Close Ticket',
      style: 'border border-black/10 text-black/50 hover:bg-black/5',
    },
  ],
  in_progress: [
    {
      to: TransitionTicketRequest.to.RESOLVED,
      label: 'Mark Resolved',
      style: 'bg-black text-white hover:bg-black/80',
    },
    {
      to: TransitionTicketRequest.to.CLOSED,
      label: 'Close Ticket',
      style: 'border border-black/10 text-black/50 hover:bg-black/5',
    },
  ],
  resolved: [
    {
      to: TransitionTicketRequest.to.CLOSED,
      label: 'Close Ticket',
      style: 'border border-black/10 text-black/50 hover:bg-black/5',
    },
  ],
  closed: [],
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

function ReplyBubble({ reply }: { reply: TicketReplyResponse }) {
  const isCoordinator = reply.authorRole === 'coordinator'
  return (
    <div className={`flex gap-3 ${isCoordinator ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          isCoordinator
            ? 'bg-red-600 text-white'
            : 'border border-black/10 bg-black/[0.04] text-black/40'
        }`}
      >
        {isCoordinator ? 'C' : <User className="h-3.5 w-3.5" />}
      </div>
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-3 ${
          isCoordinator
            ? 'rounded-tr-sm bg-black text-white'
            : 'rounded-tl-sm border border-black/[0.08] bg-white text-black'
        }`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{reply.text}</p>
        <p className={`mt-1.5 text-[11px] ${isCoordinator ? 'text-white/40' : 'text-black/30'}`}>
          {isCoordinator ? 'You (Coordinator)' : 'Student'} · {formatDate(reply.createdAt)}
        </p>
      </div>
    </div>
  )
}

function TicketViewContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''

  const [ticket, setTicket] = useState<TicketResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)
  const [transitioning, setTransitioning] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await apiFetch<TicketResponse>(`/api/v1/tickets/${id}`)
        setTicket(data)
      } catch (err) {
        setError(getApiErrorMessage(err, 'Failed to load ticket'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

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
      const reply = await apiFetch<TicketReplyResponse>(`/api/v1/tickets/${id}/replies`, {
        method: 'POST',
        body: { text: replyText.trim() },
      })
      setReplyText('')
      setTicket((t) => (t ? { ...t, replies: [...t.replies, reply] } : t))
    } catch (err) {
      setReplyError(getApiErrorMessage(err, 'Failed to send reply'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleTransition = async (to: TransitionTicketRequest.to) => {
    if (!ticket) return
    setTransitioning(to)
    try {
      const updated = await apiFetch<TicketResponse>(`/api/v1/tickets/${id}/transitions`, {
        method: 'POST',
        body: { to },
      })
      setTicket(updated)
    } catch {
      // ticket state unchanged
    } finally {
      setTransitioning(null)
    }
  }

  if (!id) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
        <p className="text-sm text-red-700">No ticket ID provided.</p>
      </div>
    )
  }

  if (loading) {
    return <CoordinatorContentSkeleton title="Loading ticket…" />
  }

  if (error || !ticket) {
    return (
      <div className="space-y-4">
        <Link
          href="/coordinator/tickets"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-black/40 hover:text-black"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Tickets
        </Link>
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <p className="text-sm text-red-700">{error ?? 'Ticket not found.'}</p>
        </div>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG['open']!
  const transitions = TRANSITIONS[ticket.status] ?? []
  const canReply = ticket.status !== 'closed'

  return (
    <div className="space-y-5">
      <Link
        href="/coordinator/tickets"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-black/40 transition hover:text-black"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Tickets
      </Link>

      <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
        {/* Left: conversation */}
        <div className="space-y-4">
          {/* Ticket header */}
          <div className="rounded-3xl border border-black/[0.08] bg-white p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-widest text-red-600 uppercase">
                  Support Ticket
                </p>
                <h1 className="mt-1.5 text-xl font-bold text-black">{ticket.subject}</h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-black/35">
                  <span className="font-mono">{ticket.userId}</span>
                  {ticket.category && (
                    <>
                      <span>·</span>
                      <span>{CATEGORY_LABELS[ticket.category] ?? ticket.category}</span>
                    </>
                  )}
                  <span>·</span>
                  <span>
                    {new Date(ticket.createdAt).toLocaleDateString('en-AU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${statusCfg.pill}`}
              >
                {statusCfg.label}
              </span>
            </div>
          </div>

          {/* Thread */}
          <div className="rounded-3xl border border-black/[0.08] bg-black/[0.02] p-5">
            <div className="space-y-4">
              {/* Original body */}
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white">
                  <User className="h-3.5 w-3.5 text-black/40" />
                </div>
                <div className="max-w-[70%] rounded-2xl rounded-tl-sm border border-black/[0.08] bg-white px-4 py-3">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-black">
                    {ticket.body}
                  </p>
                  <p className="mt-1.5 text-[11px] text-black/30">
                    Student · {formatDate(ticket.createdAt)}
                  </p>
                </div>
              </div>

              {ticket.replies.map((reply) => (
                <ReplyBubble key={reply.id} reply={reply} />
              ))}

              {ticket.replies.length === 0 && (
                <p className="py-4 text-center text-xs text-black/25">
                  No replies yet — be the first to respond.
                </p>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          {/* Reply input */}
          {canReply ? (
            <div className="rounded-3xl border border-black/[0.08] bg-white p-5">
              {replyError && (
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
                  <p className="text-xs text-red-700">{replyError}</p>
                </div>
              )}
              <label className="mb-2 block text-xs font-bold tracking-widest text-black/40 uppercase">
                Reply as Coordinator
              </label>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                disabled={submitting}
                rows={4}
                placeholder="Type your reply to the student…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleReply()
                }}
                className="w-full resize-none rounded-2xl border border-black/10 bg-black/[0.02] p-3 text-sm text-black transition outline-none focus:border-red-400 focus:bg-white disabled:opacity-50"
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-black/25">⌘↵ to send</span>
                <button
                  type="button"
                  onClick={handleReply}
                  disabled={submitting || !replyText.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                  {submitting ? 'Sending…' : 'Send Reply'}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-black/[0.08] bg-black/[0.02] px-5 py-4 text-center text-sm text-black/30">
              This ticket is closed and no longer accepting replies.
            </div>
          )}
        </div>

        {/* Right: actions + details */}
        <div className="space-y-4">
          {/* Actions */}
          {transitions.length > 0 && (
            <div className="rounded-3xl border border-black/[0.08] bg-white p-5">
              <p className="mb-3 text-xs font-bold tracking-widest text-black/40 uppercase">
                Actions
              </p>
              <div className="space-y-2">
                {transitions.map(({ to, label, style }) => (
                  <button
                    key={to}
                    type="button"
                    onClick={() => handleTransition(to)}
                    disabled={transitioning !== null}
                    className={`w-full rounded-xl px-3 py-2.5 text-sm font-bold transition disabled:opacity-50 ${style}`}
                  >
                    {transitioning === to ? 'Updating…' : label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Status */}
          <div className="rounded-3xl border border-black/[0.08] bg-white p-5">
            <p className="mb-3 text-xs font-bold tracking-widest text-black/40 uppercase">Status</p>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${statusCfg.dot}`} />
              <span className="font-semibold text-black">{statusCfg.label}</span>
            </div>
          </div>

          {/* Details */}
          <div className="rounded-3xl border border-black/[0.08] bg-white p-5">
            <p className="mb-3 text-xs font-bold tracking-widest text-black/40 uppercase">
              Details
            </p>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-black/30">Student ID</dt>
                <dd className="mt-0.5 font-mono text-xs break-all text-black/70">
                  {ticket.userId}
                </dd>
              </div>
              {ticket.category && (
                <div>
                  <dt className="text-xs text-black/30">Category</dt>
                  <dd className="mt-0.5 font-medium text-black">
                    {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-black/30">Opened</dt>
                <dd className="mt-0.5 text-black/70">
                  {new Date(ticket.createdAt).toLocaleDateString('en-AU', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-black/30">Replies</dt>
                <dd className="mt-0.5 text-xl font-black text-black">{ticket.replies.length}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CoordinatorTicketViewPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <CoordinatorContentSkeleton title="Loading ticket…" />
        </div>
      }
    >
      <TicketViewContent />
    </Suspense>
  )
}
