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
  courses,
  selfSourcedJobs,
  semesters,
  type SelfSourcedJob,
} from '@/lib/coordinator/mockData'
import { useCoordinatorApiResource } from '@/hooks/useCoordinatorApiResource'
import { listOpportunities } from '@/lib/coordinator/api'
import { mapOpportunityToSelfSourcedJob } from '@/lib/coordinator/apiMappers'
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

export function JobsList() {
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
    data: jobs,
    loading,
    error,
    source,
  } = useCoordinatorApiResource(
    async () => {
      if (process.env.NODE_ENV === 'development') {
        console.debug(
          '[coordinator/jobs] backend filters: type=custom; UI filters/search/sort/page are client-side'
        )
      }
      const response = await listOpportunities({
        type: 'custom',
        limit: 100,
        sort: '-createdAt',
      })
      return response.items.map(mapOpportunityToSelfSourcedJob)
    },
    selfSourcedJobs,
    'placement-reviews',
    { emptyData: [] }
  )

  if (loading) {
    return <CoordinatorContentSkeleton title="Loading review queue..." />
  }

  const filteredJobs = jobs
    .filter((job) => matchesParam(job.status, status))
    .filter((job) => matchesParam(job.semester, semester))
    .filter((job) => matchesParam(job.course, course))
    .filter((job) => {
      if (!search) return true
      return (
        job.studentName.toLowerCase().includes(search) ||
        job.company.toLowerCase().includes(search) ||
        job.jobTitle.toLowerCase().includes(search)
      )
    })
    .sort((a, b) => {
      if (sort === 'status') {
        const diff = a.status.localeCompare(b.status)
        return direction === 'asc' ? diff : -diff
      }

      return compareByDate(a.submissionDate, b.submissionDate, direction)
    })

  const paged = paginate(filteredJobs, page, 3)
  const columns: ApprovalColumn<SelfSourcedJob>[] = [
    { key: 'student', header: 'Student Name', render: (job) => job.studentName },
    { key: 'course', header: 'Course', render: (job) => job.course },
    { key: 'title', header: 'Job Title', render: (job) => job.jobTitle },
    { key: 'company', header: 'Company', render: (job) => job.company },
    {
      key: 'date',
      header: (
        <Link href={sortHref(params, 'date')} className="inline-flex items-center gap-1">
          Submission Date
          <ArrowUpDown className="h-3 w-3" />
        </Link>
      ),
      render: (job) => formatDate(job.submissionDate),
    },
    {
      key: 'status',
      header: (
        <Link href={sortHref(params, 'status')} className="inline-flex items-center gap-1">
          Status
          <ArrowUpDown className="h-3 w-3" />
        </Link>
      ),
      render: (job) => <StatusBadge status={job.status} />,
    },
    {
      key: 'risk',
      header: 'Risk',
      render: (job) => (
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
          {job.riskLevel ?? 'Low'}
        </span>
      ),
    },
    {
      key: 'ai',
      header: 'AI Confidence',
      render: (job) => <span className="font-bold text-slate-950">{job.aiConfidence ?? 84}%</span>,
    },
    {
      key: 'details',
      header: 'View Details',
      render: (job) => (
        <TableDetailLink href={`/coordinator/jobs/review?id=${encodeURIComponent(job.id)}`} />
      ),
    },
  ]

  return (
    <>
      <AIInsightCard
        title={`Placement Review AI Insights (${source === 'api' ? 'API-backed' : 'fallback data'})`}
        confidence={91}
        insight="Remote supervision and unclear learning outcomes are the most common concerns in the current job approval queue."
      />
      {error && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          {`Using isolated fallback data: ${error}`}
        </div>
      )}
      {!loading && !error && source === 'api' && jobs.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Backend connected, but no records exist yet.
        </div>
      )}
      <AnalyticsStrip
        items={[
          {
            label: 'Pending',
            value: filteredJobs.filter((job) => job.status === 'pending').length,
            detail: 'New role checks',
            tone: 'charcoal',
          },
          {
            label: 'Flagged',
            value: filteredJobs.filter((job) => job.status === 'flagged').length,
            detail: 'Needs evidence',
            tone: 'red',
          },
          {
            label: 'Avg confidence',
            value: '88%',
            detail: 'AI suitability score',
            tone: 'charcoal',
          },
          {
            label: 'Approved',
            value: filteredJobs.filter((job) => job.status === 'approved').length,
            detail: 'Ready placements',
            tone: 'charcoal',
          },
        ]}
      />
      <FilterBar
        search={{
          name: 'search',
          label: 'Search',
          placeholder: 'Student, company, or role',
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
        getRowKey={(job) => job.id}
        emptyMessage="No placement reviews match these filters."
      />
      <Pagination
        page={paged.page}
        totalPages={paged.totalPages}
        getHref={(nextPage) => pageHref(params, nextPage)}
      />
    </>
  )
}
