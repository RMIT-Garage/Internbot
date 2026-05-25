'use client'

import Link from 'next/link'
import { Inbox, RefreshCw, Circle, Clock, CheckCircle, XCircle, ChevronRight } from 'lucide-react'
import { useTickets } from '../hooks/useTickets'
import type { TicketListItemResponse } from '../hooks/useTickets'

const STATUS: Record<TicketListItemResponse['status'], { label: string; icon: React.ReactNode }> = {
  open: { label: 'Open', icon: <Circle className="size-3 text-red-700" /> },
  in_progress: { label: 'In Progress', icon: <Clock className="size-3 text-amber-500" /> },
  resolved: { label: 'Resolved', icon: <CheckCircle className="size-3 text-green-600" /> },
  closed: { label: 'Closed', icon: <XCircle className="size-3 text-zinc-300" /> },
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
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export function TicketList({ refreshTrigger }: { refreshTrigger?: number }) {
  const { tickets, loading, error, refresh } = useTickets(refreshTrigger)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">
          Your tickets
          {tickets.length > 0 && (
            <span className="ml-1.5 font-normal text-zinc-400">({tickets.length})</span>
          )}
        </h2>
        <button
          onClick={refresh}
          disabled={loading}
          aria-label="Refresh"
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-500 transition hover:bg-zinc-50 disabled:opacity-50"
        >
          <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <p className="rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-600">{error}</p>
      )}

      {loading && !error && (
        <div className="space-y-2.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[62px] animate-pulse rounded-xl bg-zinc-100" />
          ))}
        </div>
      )}

      {!loading && !error && tickets.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-200 py-14 text-center">
          <Inbox className="size-8 text-zinc-200" />
          <div>
            <p className="text-sm font-medium text-zinc-600">No tickets yet</p>
            <p className="mt-0.5 text-xs text-zinc-400">Submitted tickets will appear here</p>
          </div>
        </div>
      )}

      {!loading && tickets.length > 0 && (
        <div className="space-y-2">
          {tickets.map((t) => {
            const status = STATUS[t.status]
            return (
              <Link
                key={t.id}
                href={`/student/advisor/ticket?id=${t.id}`}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3.5 transition hover:border-zinc-300 hover:bg-zinc-50"
              >
                <span className="mt-0.5 shrink-0">{status.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-800">{t.subject}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-zinc-500">{status.label}</span>
                    {t.category && (
                      <>
                        <span className="text-xs text-zinc-200">·</span>
                        <span className="text-xs text-zinc-400">
                          {CATEGORY_LABELS[t.category] ?? t.category}
                        </span>
                      </>
                    )}
                    <span className="text-xs text-zinc-200">·</span>
                    <span className="text-xs text-zinc-400">{timeAgo(t.updatedAt)}</span>
                  </div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-zinc-300" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
