'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowUpDown } from 'lucide-react'
import {
  ApprovalTable,
  type ApprovalColumn,
  TableDetailLink,
} from '@/components/coordinator/ApprovalTable'
import { CoordinatorContentSkeleton } from '@/components/coordinator/CoordinatorContentSkeleton'
import { FilterBar } from '@/components/coordinator/FilterBar'
import { Pagination } from '@/components/coordinator/Pagination'
import { AIInsightCard, AnalyticsStrip } from '@/components/coordinator/Premium'
import { StatusBadge } from '@/components/coordinator/StatusBadge'
import {
  contractApprovals,
  courses,
  semesters,
  type ContractApproval,
} from '@/lib/coordinator/mockData'
import { useCoordinatorApiResource } from '@/hooks/useCoordinatorApiResource'
import { listInternships } from '@/lib/coordinator/api'
import { mapInternshipToContractApproval } from '@/lib/coordinator/apiMappers'
import {
  compareByDate,
  matchesParam,
  paginate,
  type SortDirection,
} from '@/lib/coordinator/listUtils'
import { formatDate } from '@/lib/utils'

const statusOptions = [
  { label: 'All statuses', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Flagged', value: 'flagged' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Changes requested', value: 'changes_requested' },
]

function pageHref(searchParams: URLSearchParams, page: number) {
  const params = new URLSearchParams(searchParams)
  params.set('page', String(page))
  return `?${params.toString()}`
}

function sortHref(searchParams: URLSearchParams, sort: string) {
  const params = new URLSearchParams(searchParams)
  const currentSort = params.get('sort')
  const currentDirection = params.get('direction')
  const nextDirection = currentSort === sort && currentDirection === 'asc' ? 'desc' : 'asc'

  params.delete('page')
  params.set('sort', sort)
  params.set('direction', nextDirection)
  return `?${params.toString()}`
}

export function ContractsList() {
  const searchParams = useSearchParams()
  const params = new URLSearchParams(searchParams)
  const status = params.get('status') ?? undefined
  const semester = params.get('semester') ?? undefined
  const course = params.get('course') ?? undefined
  const search = params.get('search')?.toLowerCase()
  const sort = params.get('sort') ?? 'date'
  const direction = (params.get('direction') === 'asc' ? 'asc' : 'desc') satisfies SortDirection
  const page = Number(params.get('page') ?? '1')
  const {
    data: contracts,
    loading,
    error,
    source,
  } = useCoordinatorApiResource(
    async () => {
      if (process.env.NODE_ENV === 'development') {
        console.debug(
          '[coordinator/contracts] backend filters: status=offer_pending_review; UI filters/search/sort/page are client-side'
        )
      }
      const response = await listInternships({
        limit: 100,
        status: 'offer_pending_review',
        sort: '-lastSubmittedAt',
      })
      return response.items.map(mapInternshipToContractApproval)
    },
    contractApprovals,
    'contracts',
    { emptyData: [] }
  )

  if (loading) {
    return <CoordinatorContentSkeleton title="Loading review queue..." />
  }

  const filteredContracts = contracts
    .filter((contract) => matchesParam(contract.status, status))
    .filter((contract) => matchesParam(contract.semester, semester))
    .filter((contract) => matchesParam(contract.course, course))
    .filter((contract) => {
      if (!search) return true
      return (
        contract.studentName.toLowerCase().includes(search) ||
        contract.placementHost.toLowerCase().includes(search) ||
        contract.documentName.toLowerCase().includes(search)
      )
    })
    .sort((a, b) => {
      if (sort === 'status') {
        const diff = a.status.localeCompare(b.status)
        return direction === 'asc' ? diff : -diff
      }

      return compareByDate(a.submissionDate, b.submissionDate, direction)
    })

  const paged = paginate(filteredContracts, page, 3)
  const columns: ApprovalColumn<ContractApproval>[] = [
    { key: 'student', header: 'Student Name', render: (contract) => contract.studentName },
    { key: 'course', header: 'Course', render: (contract) => contract.course },
    { key: 'semester', header: 'Semester', render: (contract) => contract.semester },
    {
      key: 'date',
      header: (
        <Link href={sortHref(params, 'date')} className="inline-flex items-center gap-1">
          Submission Date
          <ArrowUpDown className="h-3 w-3" />
        </Link>
      ),
      render: (contract) => formatDate(contract.submissionDate),
    },
    {
      key: 'status',
      header: (
        <Link href={sortHref(params, 'status')} className="inline-flex items-center gap-1">
          Status
          <ArrowUpDown className="h-3 w-3" />
        </Link>
      ),
      render: (contract) => <StatusBadge status={contract.status} />,
    },
    {
      key: 'risk',
      header: 'Risk',
      render: (contract) => (
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
          {contract.riskLevel ?? 'Low'}
        </span>
      ),
    },
    {
      key: 'ai',
      header: 'AI Confidence',
      render: (contract) => (
        <span className="font-bold text-slate-950">{contract.aiConfidence ?? 86}%</span>
      ),
    },
    {
      key: 'details',
      header: 'View Details',
      render: (contract) => (
        <TableDetailLink
          href={`/coordinator/contracts/review?id=${encodeURIComponent(contract.id)}`}
        />
      ),
    },
  ]

  return (
    <>
      <AIInsightCard
        title={`Contract AI Triage (${source === 'api' ? 'API-backed' : 'fallback data'})`}
        confidence={89}
        insight="High-risk contracts are mostly missing insurance clauses or date alignment. Prioritise flagged rows before standard pending approvals."
      />
      {error && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          {`Using isolated fallback data: ${error}`}
        </div>
      )}
      {!loading && !error && source === 'api' && contracts.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Backend connected, but no records exist yet.
        </div>
      )}
      <AnalyticsStrip
        items={[
          {
            label: 'Pending',
            value: filteredContracts.filter((contract) => contract.status === 'pending').length,
            detail: 'Awaiting review',
            tone: 'charcoal',
          },
          {
            label: 'Flagged',
            value: filteredContracts.filter((contract) => contract.status === 'flagged').length,
            detail: 'High risk signals',
            tone: 'red',
          },
          {
            label: 'Avg confidence',
            value: '82%',
            detail: 'AI review certainty',
            tone: 'charcoal',
          },
          { label: 'SLA pressure', value: '3', detail: 'Older than 72 hours', tone: 'red' },
        ]}
      />
      <FilterBar
        search={{
          name: 'search',
          label: 'Search',
          placeholder: 'Student, host, or document',
          value: search,
        }}
        selects={[
          { name: 'status', label: 'Status', value: status, options: statusOptions },
          {
            name: 'semester',
            label: 'Semester',
            value: semester,
            options: [
              { label: 'All semesters', value: 'all' },
              ...semesters.map((item) => ({ label: item, value: item })),
            ],
          },
          {
            name: 'course',
            label: 'Course',
            value: course,
            options: [
              { label: 'All courses', value: 'all' },
              ...courses.map((item) => ({ label: item, value: item })),
            ],
          },
        ]}
      />
      <ApprovalTable
        rows={paged.rows}
        columns={columns}
        getRowKey={(contract) => contract.id}
        emptyMessage="No contract submissions match these filters."
      />
      <Pagination
        page={paged.page}
        totalPages={paged.totalPages}
        getHref={(nextPage) => pageHref(params, nextPage)}
      />
    </>
  )
}
