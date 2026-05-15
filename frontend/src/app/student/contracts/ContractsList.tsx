'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowUpDown } from 'lucide-react'

import { FilterBar } from '@/components/student/FilterBar'
import { Pagination } from '@/components/student/Pagination'
import { StatusBadge } from '@/components/student/StatusBadge'
import { AIInsightCard, AnalyticsStrip } from '@/components/student/Premium'

/* -----------------------------
   SAFE LOCAL FALLBACK DATA
------------------------------ */

const contractApprovals = [
  {
    id: '1',
    studentName: 'Alex Johnson',
    course: 'Computer Science',
    semester: '2024 S1',
    submissionDate: '2025-05-10',
    status: 'pending',
    placementHost: 'Tech Corp',
    documentName: 'Internship Contract',
    riskLevel: 'Low',
    aiConfidence: 86,
  },
  {
    id: '2',
    studentName: 'Samantha Lee',
    course: 'Software Engineering',
    semester: '2024 S2',
    submissionDate: '2025-05-08',
    status: 'flagged',
    placementHost: 'BuildSoft',
    documentName: 'Placement Agreement',
    riskLevel: 'High',
    aiConfidence: 78,
  },
]

const courses = ['Computer Science', 'Software Engineering', 'Information Technology']
const semesters = ['2024 S1', '2024 S2', '2025 S1']

/* -----------------------------
   LOCAL UTILITIES (replacing coordinator/listUtils)
------------------------------ */

type SortDirection = 'asc' | 'desc'

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
  const end = start + pageSize

  return {
    rows: items.slice(start, end),
    page: safePage,
    totalPages,
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString()
}

/* -----------------------------
   MAIN COMPONENT
------------------------------ */

const statusOptions = [
  { label: 'All statuses', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Flagged', value: 'flagged' },
  { label: 'Approved', value: 'approved' },
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
  const direction = (params.get('direction') === 'asc' ? 'asc' : 'desc') as SortDirection

  const page = Number(params.get('page') ?? '1')

  /* -----------------------------
     DATA (fallback mode)
  ------------------------------ */

  const contracts = contractApprovals
  const loading = false
  const error = null
  const source = 'fallback'

  /* -----------------------------
     FILTER + SORT LOGIC
  ------------------------------ */

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

  const columns = [
    { key: 'student', header: 'Student Name', render: (c: any) => c.studentName },
    { key: 'course', header: 'Course', render: (c: any) => c.course },
    { key: 'semester', header: 'Semester', render: (c: any) => c.semester },
    {
      key: 'date',
      header: (
        <Link href={sortHref(params, 'date')} className="inline-flex items-center gap-1">
          Submission Date <ArrowUpDown className="h-3 w-3" />
        </Link>
      ),
      render: (c: any) => formatDate(c.submissionDate),
    },
    {
      key: 'status',
      header: (
        <Link href={sortHref(params, 'status')} className="inline-flex items-center gap-1">
          Status <ArrowUpDown className="h-3 w-3" />
        </Link>
      ),
      render: (c: any) => <StatusBadge status={c.status} />,
    },
    {
      key: 'risk',
      header: 'Risk',
      render: (c: any) => (
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
          {c.riskLevel ?? 'Low'}
        </span>
      ),
    },
    {
      key: 'ai',
      header: 'AI Confidence',
      render: (c: any) => <span className="font-bold text-slate-950">{c.aiConfidence ?? 86}%</span>,
    },
    {
      key: 'details',
      header: 'View Details',
      render: (c: any) => (
        <Link href={`/coordinator/contracts/${c.id}`} className="text-red-700 underline">
          View
        </Link>
      ),
    },
  ]

  /* -----------------------------
     UI (UNCHANGED STRUCTURE)
  ------------------------------ */

  return (
    <>
      <AIInsightCard
        title={`Contract AI Triage (${source})`}
        confidence={89}
        insight="High-risk contracts are mostly missing insurance clauses or date alignment. Prioritise flagged rows before standard pending approvals."
      />

      {(loading || error) && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          {loading
            ? 'Loading internship offer reviews...'
            : `Using isolated fallback data: ${error}`}
        </div>
      )}

      <AnalyticsStrip
        items={[
          {
            label: 'Pending',
            value: filteredContracts.filter((c) => c.status === 'pending').length,
            detail: 'Awaiting review',
            tone: 'blue',
          },
          {
            label: 'Flagged',
            value: filteredContracts.filter((c) => c.status === 'flagged').length,
            detail: 'High risk signals',
            tone: 'red',
          },
          {
            label: 'Avg confidence',
            value: '82%',
            detail: 'AI review certainty',
            tone: 'charcoal',
          },
          {
            label: 'SLA pressure',
            value: '3',
            detail: 'Older than 72 hours',
            tone: 'red',
          },
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
              ...semesters.map((s) => ({ label: s, value: s })),
            ],
          },
          {
            name: 'course',
            label: 'Course',
            value: course,
            options: [
              { label: 'All courses', value: 'all' },
              ...courses.map((c) => ({ label: c, value: c })),
            ],
          },
        ]}
      />

      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="min-w-full text-sm">
          <tbody>
            {paged.rows.map((c: any) => (
              <tr key={c.id} className="border-b">
                <td className="p-3">{c.studentName}</td>
                <td className="p-3">{c.course}</td>
                <td className="p-3">{c.semester}</td>
                <td className="p-3">
                  <StatusBadge status={c.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={paged.page}
        totalPages={paged.totalPages}
        getHref={(nextPage) => pageHref(params, nextPage)}
      />
    </>
  )
}
