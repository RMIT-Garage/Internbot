'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Search,
  SlidersHorizontal,
  XCircle,
} from 'lucide-react'

import { StatusBadge, type StudentStatus } from '@/components/student/StatusBadge'
import { SurfaceCard } from '@/components/student/Premium'
import { Skeleton } from '@/components/ui/ContentSkeleton'
import { InternshipsService } from '@/lib/api/openapi-client'
import type { InternshipListItemResponse } from '@/lib/api/openapi-client'
import { getApiErrorMessage } from '@/lib/api/errors'

type SortDirection = 'asc' | 'desc'

function internshipStatusToBadge(status: InternshipListItemResponse.status): StudentStatus {
  const map: Record<string, StudentStatus> = {
    applied: 'applied',
    offer_pending_review: 'offer_pending_review',
    offer_changes_requested: 'offer_changes_requested',
    offer_approved: 'offer_approved',
    rejected: 'rejected',
  }
  return map[status] ?? 'applied'
}

function opportunityTypeLabel(type: InternshipListItemResponse.opportunityType): string {
  return type === 'custom' ? 'Self-sourced' : 'Pre-approved'
}

function compareByDate(a: string, b: string, direction: SortDirection) {
  const diff = new Date(a).getTime() - new Date(b).getTime()
  return direction === 'asc' ? diff : -diff
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const start = (safePage - 1) * pageSize
  return { rows: items.slice(start, start + pageSize), page: safePage, totalPages }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function pageHref(searchParams: URLSearchParams, page: number) {
  const params = new URLSearchParams(searchParams)
  params.set('page', String(page))
  return `?${params.toString()}`
}

const statusOptions = [
  { label: 'All statuses', value: 'all' },
  { label: 'Applied', value: 'applied' },
  { label: 'Under review', value: 'offer_pending_review' },
  { label: 'Changes requested', value: 'offer_changes_requested' },
  { label: 'Approved', value: 'offer_approved' },
  { label: 'Rejected', value: 'rejected' },
]

const kpiConfig = [
  {
    key: 'applied',
    label: 'Applied',
    sub: 'Awaiting response',
    icon: Clock,
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-500',
    numCls: 'text-gray-900',
  },
  {
    key: 'offer_pending_review',
    label: 'Under review',
    sub: 'With coordinator',
    icon: FileText,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-500',
    numCls: 'text-red-600',
  },
  {
    key: 'offer_approved',
    label: 'Approved',
    sub: 'Confirmed placements',
    icon: CheckCircle2,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-500',
    numCls: 'text-red-600',
  },
  {
    key: 'flagged',
    label: 'Needs action',
    sub: 'Changes or rejected',
    icon: XCircle,
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-500',
    numCls: 'text-gray-900',
  },
]

export function ContractsList() {
  const searchParams = useSearchParams()
  const params = new URLSearchParams(searchParams)
  const sort = params.get('sort') ?? 'date'
  const direction = (params.get('direction') === 'asc' ? 'asc' : 'desc') as SortDirection
  const page = Number(params.get('page') ?? '1')

  const [internships, setInternships] = useState<InternshipListItemResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const res = await InternshipsService.listInternships()
        setInternships(res.items)
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, 'Failed to load applications'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = internships
    .filter((i) => statusFilter === 'all' || i.status === statusFilter)
    .filter((i) => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        i.opportunityEmployerName.toLowerCase().includes(q) ||
        i.opportunityJobTitle.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      if (sort === 'status') {
        const diff = a.status.localeCompare(b.status)
        return direction === 'asc' ? diff : -diff
      }
      return compareByDate(a.createdAt, b.createdAt, direction)
    })

  const paged = paginate(filtered, page, 12)

  const counts = {
    applied: internships.filter((i) => i.status === 'applied').length,
    offer_pending_review: internships.filter((i) => i.status === 'offer_pending_review').length,
    offer_approved: internships.filter((i) => i.status === 'offer_approved').length,
    flagged: internships.filter((i) => ['offer_changes_requested', 'rejected'].includes(i.status))
      .length,
  }

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SurfaceCard key={i} className="p-5">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-6 w-8" />
                </div>
              </div>
            </SurfaceCard>
          ))}
        </div>
        <SurfaceCard className="overflow-hidden p-0">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? 'border-t border-gray-100' : ''}`}
            >
              <Skeleton className="h-9 w-9 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-4 rounded" />
            </div>
          ))}
        </SurfaceCard>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpiConfig.map(({ key, label, sub, icon: Icon, iconBg, iconColor, numCls }) => (
          <SurfaceCard key={key} className="flex items-center gap-3 p-4">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBg}`}
            >
              <Icon className={`h-4 w-4 ${iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-wide text-gray-400 uppercase">
                {label}
              </p>
              <p className={`text-xl leading-tight font-bold ${numCls}`}>
                {key === 'flagged' ? counts.flagged : counts[key as keyof typeof counts]}
              </p>
              <p className="text-[11px] text-gray-400">{sub}</p>
            </div>
          </SurfaceCard>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1" style={{ minWidth: 200 }}>
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search employer or role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pr-4 pl-9 text-sm placeholder:text-gray-400 focus:border-red-400 focus:ring-2 focus:ring-red-100 focus:outline-none"
          />
        </div>
        <div className="relative">
          <SlidersHorizontal className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pr-8 pl-9 text-sm text-gray-700 focus:border-red-400 focus:ring-2 focus:ring-red-100 focus:outline-none"
          >
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      {paged.rows.length === 0 ? (
        <SurfaceCard className="flex flex-col items-center py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <Briefcase className="h-5 w-5 text-gray-400" />
          </div>
          <p className="mt-3 text-sm font-semibold text-gray-600">
            {search || statusFilter !== 'all' ? 'No matching applications' : 'No applications yet'}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {search || statusFilter !== 'all'
              ? 'Try adjusting your search or filter.'
              : 'Head to Opportunities to browse and apply.'}
          </p>
          {(search || statusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setStatusFilter('all')
              }}
              className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              Clear filters
            </button>
          )}
        </SurfaceCard>
      ) : (
        <SurfaceCard className="overflow-hidden p-0">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_120px_90px_140px_24px] items-center gap-4 border-b border-gray-100 bg-gray-50 px-5 py-2.5 text-xs font-semibold tracking-wide text-gray-400 uppercase">
            <span>Opportunity</span>
            <span className="text-center">Type</span>
            <span>Applied</span>
            <span>Status</span>
            <span />
          </div>

          {paged.rows.map((i, idx) => (
            <Link
              key={i.id}
              href={`/student/applications/view?id=${i.id}`}
              className={`grid grid-cols-[1fr_120px_90px_140px_24px] items-center gap-4 px-5 py-3.5 transition hover:bg-gray-50 ${idx > 0 ? 'border-t border-gray-100' : ''}`}
            >
              {/* Opportunity info */}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {i.opportunityJobTitle}
                </p>
                <p className="truncate text-xs text-gray-500">{i.opportunityEmployerName}</p>
              </div>

              {/* Type */}
              <div className="flex justify-center">
                <span className="w-fit rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                  {opportunityTypeLabel(i.opportunityType)}
                </span>
              </div>

              {/* Date */}
              <span className="shrink-0 text-xs text-gray-400">{formatDate(i.createdAt)}</span>

              {/* Status */}
              <div>
                <StatusBadge status={internshipStatusToBadge(i.status)} />
              </div>

              {/* Arrow */}
              <ArrowRight className="h-3.5 w-3.5 text-gray-300" />
            </Link>
          ))}
        </SurfaceCard>
      )}

      {/* Pagination */}
      {paged.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Page {paged.page} of {paged.totalPages}
          </p>
          <div className="flex items-center gap-1.5">
            <Link
              href={pageHref(params, paged.page - 1)}
              aria-disabled={paged.page === 1}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border text-sm transition ${
                paged.page === 1
                  ? 'pointer-events-none border-gray-100 bg-gray-50 text-gray-300'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            {Array.from({ length: paged.totalPages }, (_, idx) => idx + 1).map((p) => (
              <Link
                key={p}
                href={pageHref(params, p)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold transition ${
                  p === paged.page
                    ? 'bg-red-600 text-white'
                    : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {p}
              </Link>
            ))}
            <Link
              href={pageHref(params, paged.page + 1)}
              aria-disabled={paged.page === paged.totalPages}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border text-sm transition ${
                paged.page === paged.totalPages
                  ? 'pointer-events-none border-gray-100 bg-gray-50 text-gray-300'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
