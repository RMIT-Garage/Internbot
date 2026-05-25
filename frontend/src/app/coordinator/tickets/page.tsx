'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MessageSquare, ChevronRight, AlertCircle } from 'lucide-react'
import { CoordinatorPageHeader } from '@/components/coordinator/Premium'
import CoordinatorContentSkeleton from '@/components/coordinator/CoordinatorContentSkeleton'
import { apiFetch } from '@/lib/api/client'
import type { TicketListItemResponse } from '@/api/models/TicketListItemResponse'
import type { TicketListResponse } from '@/api/models/TicketListResponse'

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; pill: string }> = {
  open: {
    label: 'Open',
    dot: 'bg-red-600',
    text: 'text-red-700',
    pill: 'bg-red-600 text-white',
  },
  in_progress: {
    label: 'In Progress',
    dot: 'bg-red-400',
    text: 'text-red-500',
    pill: 'bg-red-100 text-red-700',
  },
  resolved: {
    label: 'Resolved',
    dot: 'bg-black',
    text: 'text-black',
    pill: 'bg-black text-white',
  },
  closed: {
    label: 'Closed',
    dot: 'bg-black/20',
    text: 'text-black/40',
    pill: 'bg-black/10 text-black/50',
  },
}

const CATEGORY_LABELS: Record<string, string> = {
  eligibility: 'Eligibility',
  credit_points: 'Credit Points',
  self_sourcing: 'Self-Sourcing',
  careerhub: 'CareerHub',
  other: 'Other',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
]

export default function CoordinatorTicketsPage() {
  const [tickets, setTickets] = useState<TicketListItemResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const query = statusFilter ? `?sort=-createdAt&status=${statusFilter}` : '?sort=-createdAt'
        const data = await apiFetch<TicketListResponse>(`/api/v1/tickets${query}`)
        setTickets(data.items ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tickets')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [statusFilter])

  const openCount = tickets.filter((t) => t.status === 'open').length
  const inProgressCount = tickets.filter((t) => t.status === 'in_progress').length
  const resolvedCount = tickets.filter((t) => t.status === 'resolved').length

  if (loading) {
    return (
      <div className="space-y-6">
        <CoordinatorPageHeader
          eyebrow="Support"
          title="Student Tickets"
          description="Review and respond to student support requests."
        />
        <CoordinatorContentSkeleton title="Loading tickets..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Support"
        title="Student Tickets"
        description="Review and respond to student support requests."
      />

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-3 divide-x divide-black/[0.07] overflow-hidden rounded-2xl border border-black/[0.08] bg-white">
        {[
          { label: 'Open', value: openCount, accent: 'text-red-600' },
          { label: 'In Progress', value: inProgressCount, accent: 'text-red-400' },
          { label: 'Resolved', value: resolvedCount, accent: 'text-black' },
        ].map(({ label, value, accent }) => (
          <div key={label} className="flex flex-col items-center gap-0.5 px-4 py-5">
            <span className={`text-3xl font-black tracking-tight ${accent}`}>{value}</span>
            <span className="text-xs font-semibold tracking-wide text-black/40 uppercase">
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map(({ label, value }) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatusFilter(value)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              statusFilter === value
                ? 'bg-black text-white'
                : 'bg-black/[0.04] text-black/50 hover:bg-black/[0.08] hover:text-black'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto self-center text-xs text-black/30">
          {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Ticket list */}
      {tickets.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-black/[0.07] bg-white py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/[0.04]">
            <MessageSquare className="h-6 w-6 text-black/20" />
          </div>
          <div>
            <p className="font-semibold text-black/40">
              {statusFilter ? `No ${statusFilter.replace('_', ' ')} tickets` : 'No tickets yet'}
            </p>
            <p className="mt-1 text-xs text-black/25">
              {statusFilter ? 'Try a different filter' : 'Student tickets will appear here'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => {
            const cfg = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG['open']!
            return (
              <Link
                key={ticket.id}
                href={`/coordinator/tickets/view?id=${ticket.id}`}
                className="group flex items-center gap-4 rounded-2xl border border-black/[0.07] bg-white px-5 py-4 transition hover:border-black/20 hover:shadow-sm"
              >
                {/* Status dot */}
                <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${cfg.dot}`} />

                {/* Main content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="truncate font-semibold text-black">{ticket.subject}</p>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cfg.pill}`}
                    >
                      {cfg.label}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-black/35">
                    <span className="font-mono">{ticket.userId.slice(0, 14)}…</span>
                    {ticket.category && (
                      <>
                        <span>·</span>
                        <span>{CATEGORY_LABELS[ticket.category] ?? ticket.category}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{timeAgo(ticket.createdAt)}</span>
                  </div>
                </div>

                {/* Arrow */}
                <ChevronRight className="h-4 w-4 shrink-0 text-black/20 transition group-hover:text-black/50" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
