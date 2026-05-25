'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Ticket } from 'lucide-react'
import { CoordinatorPageHeader, SurfaceCard } from '@/components/coordinator/Premium'
import CoordinatorContentSkeleton from '@/components/coordinator/CoordinatorContentSkeleton'
import { StatusBadge } from '@/components/coordinator/StatusBadge'
import { apiFetch } from '@/lib/api/client'
import { getUser } from '@/lib/coordinator/api'
import type { TicketListItemResponse } from '@/api/models/TicketListItemResponse'
import type { TicketListResponse } from '@/api/models/TicketListResponse'

const STATUS_BADGE_MAP: Record<string, Parameters<typeof StatusBadge>[0]['status']> = {
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
  const [studentNames, setStudentNames] = useState<Record<string, string>>({})

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

  // Resolve student names after tickets load
  useEffect(() => {
    const missingIds = Array.from(
      new Set(tickets.map((t) => t.userId).filter((id) => !studentNames[id]))
    )
    if (missingIds.length === 0) return
    let active = true
    Promise.all(
      missingIds.map(async (id) => {
        try {
          const user = await getUser(id)
          return [id, user.displayName ?? user.email ?? id] as const
        } catch {
          return [id, id] as const
        }
      })
    ).then((entries) => {
      if (!active) return
      setStudentNames((prev) => ({ ...prev, ...Object.fromEntries(entries) }))
    })
    return () => {
      active = false
    }
  }, [tickets]) // eslint-disable-line react-hooks/exhaustive-deps

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
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Open', value: openCount },
          { label: 'In Progress', value: inProgressCount },
          { label: 'Resolved', value: resolvedCount },
        ].map(({ label, value }) => (
          <SurfaceCard key={label} className="p-5">
            <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">{label}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
          </SurfaceCard>
        ))}
      </div>

      {/* Filter tabs */}
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
        <span className="ml-auto self-center text-xs text-slate-400">
          {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <SurfaceCard className="overflow-hidden p-0">
        {tickets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Ticket className="h-8 w-8 text-slate-200" />
            <p className="text-sm text-slate-500">
              {statusFilter
                ? `No ${STATUS_LABELS[statusFilter] ?? statusFilter} tickets.`
                : 'No tickets yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs font-bold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Student</th>
                  <th className="px-5 py-3">Subject</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Submitted</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map((ticket) => {
                  const badgeStatus = STATUS_BADGE_MAP[ticket.status] ?? 'inactive'
                  const studentLabel = studentNames[ticket.userId]
                  return (
                    <tr key={ticket.id} className="transition hover:bg-slate-50/80">
                      <td className="px-5 py-4">
                        {studentLabel ? (
                          <span className="font-medium text-slate-900">{studentLabel}</span>
                        ) : (
                          <span className="font-mono text-xs text-slate-400">
                            {ticket.userId.slice(0, 12)}…
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className="max-w-xs truncate font-semibold text-slate-900">
                          {ticket.subject}
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
                        <StatusBadge
                          status={badgeStatus}
                          label={STATUS_LABELS[ticket.status] ?? ticket.status}
                        />
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-slate-500">
                        {timeAgo(ticket.createdAt)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/coordinator/tickets/view?id=${ticket.id}`}
                          className="text-sm font-bold text-red-700 hover:text-red-800"
                        >
                          View Details
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
