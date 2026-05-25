'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Send, User } from 'lucide-react'
import CoordinatorContentSkeleton from '@/components/coordinator/CoordinatorContentSkeleton'
import { SurfaceCard } from '@/components/coordinator/Premium'
import { StatusBadge } from '@/components/coordinator/StatusBadge'
import { apiFetch } from '@/lib/api/client'
import { getUser } from '@/lib/coordinator/api'
import { TransitionTicketRequest } from '@/api/models/TransitionTicketRequest'
import type { TicketResponse } from '@/api/models/TicketResponse'
import type { TicketReplyResponse } from '@/api/models/TicketReplyResponse'
import { getApiErrorMessage } from '@/lib/api/errors'
import type { CoordinatorStatus } from '@/components/coordinator/StatusBadge'

const CATEGORY_LABELS: Record<string, string> = {
  eligibility: 'Eligibility',
  credit_points: 'Credit Points',
  self_sourcing: 'Self-Sourcing',
  careerhub: 'CareerHub',
  other: 'Other',
}

const STATUS_BADGE_MAP: Record<string, CoordinatorStatus> = {
  open: 'needs_attention',
  in_progress: 'on_track',
  resolved: 'approved',
  closed: 'inactive',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

const TRANSITIONS: Record<
  string,
  Array<{ to: TransitionTicketRequest.to; label: string; style: string }>
> = {
  open: [
    {
      to: TransitionTicketRequest.to.IN_PROGRESS,
      label: 'Start Reviewing',
      style: 'bg-slate-900 text-white hover:bg-black',
    },
    {
      to: TransitionTicketRequest.to.CLOSED,
      label: 'Close Ticket',
      style: 'border border-slate-200 text-slate-600 hover:bg-slate-50',
    },
  ],
  in_progress: [
    {
      to: TransitionTicketRequest.to.RESOLVED,
      label: 'Mark Resolved',
      style: 'bg-slate-900 text-white hover:bg-black',
    },
    {
      to: TransitionTicketRequest.to.CLOSED,
      label: 'Close Ticket',
      style: 'border border-slate-200 text-slate-600 hover:bg-slate-50',
    },
  ],
  resolved: [
    {
      to: TransitionTicketRequest.to.CLOSED,
      label: 'Close Ticket',
      style: 'border border-slate-200 text-slate-600 hover:bg-slate-50',
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
    <div className={`flex gap-3 ${isCoordinator ? 'justify-end' : 'justify-start'}`}>
      {!isCoordinator && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100">
          <User className="h-3.5 w-3.5 text-slate-500" />
        </div>
      )}
      <div
        className={`max-w-[72%] rounded-2xl px-4 py-3 ${
          isCoordinator
            ? 'rounded-tr-sm bg-slate-900 text-white'
            : 'rounded-tl-sm border border-slate-200 bg-white text-slate-800'
        }`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{reply.text}</p>
        <p className={`mt-1.5 text-[11px] ${isCoordinator ? 'text-slate-400' : 'text-slate-400'}`}>
          {isCoordinator ? 'You (Coordinator)' : 'Student'} · {formatDate(reply.createdAt)}
        </p>
      </div>
      {isCoordinator && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100">
          <span className="text-xs font-bold text-red-700">C</span>
        </div>
      )}
    </div>
  )
}

function TicketViewContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''

  const [ticket, setTicket] = useState<TicketResponse | null>(null)
  const [studentName, setStudentName] = useState<string | null>(null)
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
        // Fetch student name in background
        getUser(data.userId)
          .then((user) => setStudentName(user.displayName ?? user.email ?? null))
          .catch(() => {})
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
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        No ticket ID provided.
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
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Tickets
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? 'Ticket not found.'}
        </div>
      </div>
    )
  }

  const badgeStatus = STATUS_BADGE_MAP[ticket.status] ?? 'inactive'
  const transitions = TRANSITIONS[ticket.status] ?? []
  const canReply = ticket.status !== 'closed'

  return (
    <div className="space-y-5">
      <Link
        href="/coordinator/tickets"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Tickets
      </Link>

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        {/* Left: conversation */}
        <div className="space-y-4">
          <SurfaceCard className="p-5">
            <div className="mb-4 border-b border-slate-100 pb-4">
              <p className="text-xs font-bold tracking-wide text-red-600 uppercase">
                Support Ticket
              </p>
              <h1 className="mt-1 text-xl font-bold text-slate-900">{ticket.subject}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-medium text-slate-700">
                  {studentName ?? <span className="font-mono">{ticket.userId}</span>}
                </span>
                {ticket.category && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span>{CATEGORY_LABELS[ticket.category] ?? ticket.category}</span>
                  </>
                )}
                <span className="text-slate-300">·</span>
                <span>{new Date(ticket.createdAt).toLocaleDateString('en-AU')}</span>
              </div>
            </div>

            <div className="space-y-4">
              {/* Original body */}
              <div className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100">
                  <User className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div className="max-w-[72%] rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 text-slate-800">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{ticket.body}</p>
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Student · {formatDate(ticket.createdAt)}
                  </p>
                </div>
              </div>

              {ticket.replies.map((reply) => (
                <ReplyBubble key={reply.id} reply={reply} />
              ))}

              {ticket.replies.length === 0 && (
                <p className="py-3 text-center text-xs text-slate-400">
                  No replies yet. Be the first to respond.
                </p>
              )}

              <div ref={bottomRef} />
            </div>
          </SurfaceCard>

          {/* Reply input */}
          {canReply ? (
            <SurfaceCard className="p-4">
              {replyError && (
                <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {replyError}
                </div>
              )}
              <label className="mb-2 block text-xs font-bold tracking-wide text-slate-500 uppercase">
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
                className="w-full resize-none rounded-xl border border-slate-200 p-3 text-sm text-slate-900 outline-none focus:border-red-400 disabled:bg-slate-50 disabled:text-slate-400"
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">⌘↵ to send</span>
                <button
                  type="button"
                  onClick={handleReply}
                  disabled={submitting || !replyText.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-800 disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                  {submitting ? 'Sending…' : 'Send Reply'}
                </button>
              </div>
            </SurfaceCard>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-center text-sm text-slate-500">
              This ticket is closed and no longer accepting replies.
            </div>
          )}
        </div>

        {/* Right: status + actions */}
        <div className="space-y-4">
          <SurfaceCard className="p-5">
            <p className="mb-3 text-xs font-bold tracking-wide text-slate-500 uppercase">Status</p>
            <StatusBadge
              status={badgeStatus}
              label={STATUS_LABELS[ticket.status] ?? ticket.status}
            />

            {transitions.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Actions</p>
                {transitions.map(({ to, label, style }) => (
                  <button
                    key={to}
                    type="button"
                    onClick={() => handleTransition(to)}
                    disabled={transitioning !== null}
                    className={`w-full rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${style}`}
                  >
                    {transitioning === to ? 'Updating…' : label}
                  </button>
                ))}
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard className="p-5">
            <p className="mb-3 text-xs font-bold tracking-wide text-slate-500 uppercase">Details</p>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-slate-400">Student</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {studentName ?? (
                    <span className="font-mono text-xs text-slate-500">{ticket.userId}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">User ID</dt>
                <dd className="mt-0.5 font-mono text-xs break-all text-slate-500">
                  {ticket.userId}
                </dd>
              </div>
              {ticket.category && (
                <div>
                  <dt className="text-xs text-slate-400">Category</dt>
                  <dd className="mt-0.5 text-slate-700">
                    {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-slate-400">Opened</dt>
                <dd className="mt-0.5 text-slate-700">
                  {new Date(ticket.createdAt).toLocaleDateString('en-AU', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Replies</dt>
                <dd className="mt-0.5 text-lg font-bold text-slate-900">{ticket.replies.length}</dd>
              </div>
            </dl>
          </SurfaceCard>
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
