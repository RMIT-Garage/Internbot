'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowUpDown } from 'lucide-react'

import { FilterBar } from '@/components/student/FilterBar'
import { Pagination } from '@/components/student/Pagination'
import { StatusBadge, type StudentStatus } from '@/components/student/StatusBadge'
import { AnalyticsStrip } from '@/components/student/Premium'
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

function matchesParam(value: string, param?: string) {
  if (!param || param === 'all') return true
  return value === param
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
  return new Date(date).toLocaleDateString()
}

function pageHref(searchParams: URLSearchParams, page: number) {
  const params = new URLSearchParams(searchParams)
  params.set('page', String(page))
  return `?${params.toString()}`
}

function sortHref(searchParams: URLSearchParams, sort: string) {
  const params = new URLSearchParams(searchParams)
  const nextDirection =
    params.get('sort') === sort && params.get('direction') === 'asc' ? 'desc' : 'asc'
  params.delete('page')
  params.set('sort', sort)
  params.set('direction', nextDirection)
  return `?${params.toString()}`
}

const statusOptions = [
  { label: 'All statuses', value: 'all' },
  { label: 'Applied', value: 'applied' },
  { label: 'Offer pending review', value: 'offer_pending_review' },
  { label: 'Changes requested', value: 'offer_changes_requested' },
  { label: 'Approved', value: 'offer_approved' },
  { label: 'Rejected', value: 'rejected' },
]

export function ContractsList() {
  const searchParams = useSearchParams()
  const params = new URLSearchParams(searchParams)

  const status = params.get('status') ?? undefined
  const search = params.get('search')?.toLowerCase()
  const sort = params.get('sort') ?? 'date'
  const direction = (params.get('direction') === 'asc' ? 'asc' : 'desc') as SortDirection
  const page = Number(params.get('page') ?? '1')

  const [internships, setInternships] = useState<InternshipListItemResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    .filter((i) => matchesParam(i.status, status))
    .filter((i) => {
      if (!search) return true
      return (
        i.opportunityEmployerName.toLowerCase().includes(search) ||
        i.opportunityJobTitle.toLowerCase().includes(search)
      )
    })
    .sort((a, b) => {
      if (sort === 'status') {
        const diff = a.status.localeCompare(b.status)
        return direction === 'asc' ? diff : -diff
      }
      return compareByDate(a.createdAt, b.createdAt, direction)
    })

  const paged = paginate(filtered, page, 10)

  const pendingCount = internships.filter((i) => i.status === 'applied').length
  const reviewCount = internships.filter((i) => i.status === 'offer_pending_review').length
  const approvedCount = internships.filter((i) => i.status === 'offer_approved').length
  const flaggedCount = internships.filter((i) =>
    ['offer_changes_requested', 'rejected'].includes(i.status)
  ).length

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        Loading applications...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        {error}
      </div>
    )
  }

  return (
    <>
      <AnalyticsStrip
        items={[
          { label: 'Applied', value: pendingCount, detail: 'Awaiting response', tone: 'charcoal' },
          {
            label: 'Offer pending',
            value: reviewCount,
            detail: 'Under coordinator review',
            tone: 'charcoal',
          },
          {
            label: 'Approved',
            value: approvedCount,
            detail: 'Confirmed placements',
            tone: 'red',
          },
          {
            label: 'Flagged',
            value: flaggedCount,
            detail: 'Changes needed or rejected',
            tone: 'red',
          },
        ]}
      />

      <FilterBar
        search={{
          name: 'search',
          label: 'Search',
          placeholder: 'Employer or job title',
          value: search,
        }}
        selects={[{ name: 'status', label: 'Status', value: status, options: statusOptions }]}
      />

      {paged.rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          No applications found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                <th className="p-3 text-left">Employer</th>
                <th className="p-3 text-left">Role</th>
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-left">
                  <Link href={sortHref(params, 'date')} className="inline-flex items-center gap-1">
                    Date <ArrowUpDown className="h-3 w-3" />
                  </Link>
                </th>
                <th className="p-3 text-left">
                  <Link
                    href={sortHref(params, 'status')}
                    className="inline-flex items-center gap-1"
                  >
                    Status <ArrowUpDown className="h-3 w-3" />
                  </Link>
                </th>
                <th className="p-3 text-left">Details</th>
              </tr>
            </thead>
            <tbody>
              {paged.rows.map((i) => (
                <tr key={i.id} className="border-t">
                  <td className="p-3 font-medium text-slate-950">{i.opportunityEmployerName}</td>
                  <td className="p-3 text-slate-700">{i.opportunityJobTitle}</td>
                  <td className="p-3 text-slate-500 capitalize">
                    {i.opportunityType.replace('_', ' ')}
                  </td>
                  <td className="p-3 text-slate-500">{formatDate(i.createdAt)}</td>
                  <td className="p-3">
                    <StatusBadge status={internshipStatusToBadge(i.status)} />
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/student/contracts/${i.id}`}
                      className="text-red-700 underline hover:text-red-800"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={paged.page}
        totalPages={paged.totalPages}
        getHref={(nextPage) => pageHref(params, nextPage)}
      />
    </>
  )
}
