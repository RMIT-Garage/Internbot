'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Circle, Clock, CheckCircle, XCircle, Ticket } from 'lucide-react'
import { CoordinatorPageHeader, SurfaceCard } from '@/components/coordinator/Premium'
import CoordinatorContentSkeleton from '@/components/coordinator/CoordinatorContentSkeleton'
import { apiFetch } from '@/lib/api/client'
import type { TicketListItemResponse } from '@/api/models/TicketListItemResponse'
import type { TicketListResponse } from '@/api/models/TicketListResponse'

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; badge: string }> = {
  open: {
    label: 'Open',
    icon: <Circle className="h-3.5 w-3.5 text-red-600" />,
    badge: 'bg-red-50 text-red-700 border-red-200',
  },
  in_progress: {
    label: 'In Progress',
    icon: <Clock className="h-3.5 w-3.5 text-amber-500" />,
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  resolved: {
    label: 'Resolved',
    icon: <CheckCircle className="h-3.5 w-3.5 text-green-600" />,
    badge: 'bg-green-50 text-green-700 border-green-200',
  },
  closed: {
    label: 'Closed',
    icon: <XCircle className="h-3.5 w-3.5 text-slate-400" />,
    badge: 'bg-slate-50 text-slate-500 border-slate-200',
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
        const query = statusFilter ? `?sort=-updatedAt&status=${statusFilter}` : '?sort=-updatedAt'
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
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Open', value: openCount, color: 'text-red-700' },
          { label: 'In Progress', value: inProgressCount, color: 'text-amber-600' },
          {
            label: 'Total',
            value: tickets.length,
            color: 'text-slate-800',
          },
        ].map(({ label, value, color }) => (
          <SurfaceCard key={label} className="p-4">
            <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
          </SurfaceCard>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map(({ label, value }) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatusFilter(value)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              statusFilter === value
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tickets table */}
      <SurfaceCard className="overflow-hidden p-0">
        {tickets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Ticket className="h-8 w-8 text-slate-200" />
            <p className="text-sm text-slate-500">
              {statusFilter ? `No ${statusFilter.replace('_', ' ')} tickets.` : 'No tickets yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Subject</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Updated</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map((ticket) => {
                  const cfg = STATUS_CONFIG[ticket.status]
                  return (
                    <tr key={ticket.id} className="transition hover:bg-slate-50/60">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">{ticket.subject}</p>
                        <p className="mt-0.5 font-mono text-xs text-slate-400">
                          {ticket.userId.slice(0, 12)}…
                        </p>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {ticket.category ? (
                          (CATEGORY_LABELS[ticket.category] ?? ticket.category)
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {cfg && (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.badge}`}
                          >
                            {cfg.icon}
                            {cfg.label}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-500">{timeAgo(ticket.updatedAt)}</td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/coordinator/tickets/view?id=${ticket.id}`}
                          className="text-sm font-bold text-red-700 hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>
    </div>
  )
}
