'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, X } from 'lucide-react'
import CoordinatorContentSkeleton from '@/components/coordinator/CoordinatorContentSkeleton'
import { Pagination } from '@/components/coordinator/Pagination'
import { SurfaceCard } from '@/components/coordinator/Premium'
import { StatusBadge } from '@/components/coordinator/StatusBadge'
import {
  contractApprovals,
  semesters,
  type ContractApproval,
  type SelfSourcedJob,
} from '@/lib/coordinator/mockData'
import { useCoordinatorApiResource } from '@/hooks/useCoordinatorApiResource'
import { getUser, listInternships } from '@/lib/coordinator/api'
import { mapInternshipToContractApproval } from '@/lib/coordinator/apiMappers'
import { matchesParam, paginate } from '@/lib/coordinator/listUtils'
import { PLACEMENT_PROCESSING_CONTEXT, withReviewReturn } from '@/lib/coordinator/reviewRouting'
import { STUDENT_PROFILE_PENDING, formatStudentDisplay } from '@/lib/coordinator/studentDisplay'
import { formatDate } from '@/lib/utils'

type WorkflowStageId =
  | 'submitted'
  | 'documents'
  | 'review'
  | 'verification'
  | 'approved'
  | 'rejected'

type PlacementCase = SelfSourcedJob & {
  workflowKind: 'placement' | 'contract'
  reviewHref: string
  studentUserId?: string
}

function contractApprovalToPlacementCase(contract: ContractApproval): PlacementCase {
  return {
    id: contract.id,
    studentName: contract.studentName,
    studentId: contract.studentId,
    course: contract.course,
    semester: contract.semester,
    jobTitle: contract.documentName,
    company: contract.placementHost,
    submissionDate: contract.submissionDate,
    status: contract.status,
    location: 'Not supplied',
    workPattern: 'Contract verification',
    supervisor: 'Supervisor details pending',
    description: 'Student-confirmed placement submitted for coordinator verification.',
    aiAdvisory: 'Review the submitted placement evidence, contracts, and coordinator notes.',
    concerns: contract.aiIssues,
    notes: contract.notes,
    aiConfidence: contract.aiConfidence,
    riskLevel: contract.riskLevel,
    workflowKind: 'contract',
    reviewHref: `/coordinator/contracts/review?id=${encodeURIComponent(contract.id)}`,
    studentUserId: contract.studentUserId,
  }
}

const statusOptions = [
  { label: 'All statuses', value: 'all' },
  { label: 'Awaiting contract review', value: 'awaiting_contract_review' },
  { label: 'Awaiting documents', value: 'awaiting_documents' },
  { label: 'Awaiting approval', value: 'awaiting_approval' },
  { label: 'Flagged', value: 'flagged' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
]

const stageOptions = [
  { label: 'All stages', value: 'all' },
  { label: 'Placement Confirmed', value: 'submitted' },
  { label: 'Documents Submitted', value: 'documents' },
  { label: 'Contract Review', value: 'verification' },
  { label: 'Final Approval', value: 'review' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
]

const actionOptions = [
  { label: 'All action states', value: 'all' },
  { label: 'Action required', value: 'required' },
  { label: 'No immediate action', value: 'clear' },
]

const outcomeOptions = [
  { label: 'All outcomes', value: 'all' },
  { label: 'Active queue', value: 'active' },
  { label: 'Approved or rejected', value: 'closed' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
]

const sortOptions = [
  { label: 'Action required first', value: 'action_required' },
  { label: 'Newest confirmation first', value: 'newest' },
  { label: 'Oldest confirmation first', value: 'oldest' },
  { label: 'Recently updated', value: 'recently_updated' },
  { label: 'Oldest waiting', value: 'oldest_waiting' },
  { label: 'Student name A-Z', value: 'student' },
  { label: 'Employer A-Z', value: 'employer' },
  { label: 'Stage order', value: 'stage' },
]

const waitingOptions = [
  { label: 'All waiting states', value: 'all' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Waiting 1+ days', value: 'waiting' },
  { label: 'Submitted today', value: 'today' },
]

function pageHref(searchParams: URLSearchParams, page: number) {
  const params = new URLSearchParams(searchParams)
  params.set('page', String(page))
  return `?${params.toString()}`
}

function removeFilterHref(searchParams: URLSearchParams, name: string) {
  const params = new URLSearchParams(searchParams)
  params.delete(name)
  params.delete('page')
  const query = params.toString()
  return query ? `?${query}` : '/coordinator/jobs'
}

export function JobsList() {
  const [studentLabels, setStudentLabels] = useState<Record<string, string>>({})
  const searchParams = useSearchParams()
  const params = new URLSearchParams(searchParams)
  const stage = params.get('stage') ?? undefined
  const status = params.get('status') ?? undefined
  const semester = params.get('semester') ?? undefined
  const course = params.get('course') ?? undefined
  const action = params.get('action') ?? undefined
  const outcome = params.get('outcome') ?? undefined
  const waiting = params.get('waiting') ?? undefined
  const employer = params.get('employer') ?? undefined
  const searchValue = params.get('search') ?? undefined
  const search = searchValue?.toLowerCase()
  const employerSearch = employer?.toLowerCase()
  const sort = params.get('sort') ?? 'action_required'
  const page = Number(params.get('page') ?? '1')
  const currentJobsHref = `/coordinator/jobs${params.toString() ? `?${params.toString()}` : ''}`
  const {
    data: jobs,
    loading,
    error,
    source,
  } = useCoordinatorApiResource(
    async () => {
      if (process.env.NODE_ENV === 'development') {
        console.debug(
          '[coordinator/jobs] backend filters: full placement verification list; UI filters/search/sort/page are client-side'
        )
      }
      const internshipResponse = await listInternships({
        limit: 100,
        sort: '-lastSubmittedAt',
      })

      return internshipResponse.items
        .filter((internship) => internship.status !== 'applied')
        .map((internship): PlacementCase => {
          const mapped = mapInternshipToContractApproval(internship)
          return contractApprovalToPlacementCase(mapped)
        })
    },
    contractApprovals.map(contractApprovalToPlacementCase),
    'placement-reviews',
    { emptyData: [] }
  )

  useEffect(() => {
    const missingIds = Array.from(
      new Set(
        jobs
          .map((job) => job.studentUserId)
          .filter((id): id is string => Boolean(id && !studentLabels[id]))
      )
    )
    if (missingIds.length === 0) return

    let active = true
    Promise.all(
      missingIds.map(async (id) => {
        try {
          return [id, formatStudentDisplay(await getUser(id))] as const
        } catch {
          return [id, STUDENT_PROFILE_PENDING] as const
        }
      })
    ).then((entries) => {
      if (!active) return
      setStudentLabels((current) => ({ ...current, ...Object.fromEntries(entries) }))
    })

    return () => {
      active = false
    }
  }, [jobs, studentLabels])

  if (loading) {
    return <CoordinatorContentSkeleton />
  }

  const filteredJobs = jobs
    .filter((job) => matchesParam(getCurrentStageId(job), stage))
    .filter((job) => matchesParam(job.status, status))
    .filter((job) => matchesParam(job.semester, semester))
    .filter((job) => matchesCourseFilter(job, course))
    .filter((job) => matchesActionFilter(job, action))
    .filter((job) => matchesOutcomeFilter(job, outcome))
    .filter((job) => matchesWaitingFilter(job, waiting))
    .filter((job) => {
      if (!employerSearch) return true
      return job.company.toLowerCase().includes(employerSearch)
    })
    .filter((job) => {
      if (!search) return true
      const studentLabel = placementStudentLabel(job, studentLabels)
      return (
        studentLabel.toLowerCase().includes(search) ||
        job.company.toLowerCase().includes(search) ||
        job.jobTitle.toLowerCase().includes(search)
      )
    })
    .sort((a, b) => compareQueueItems(a, b, sort, studentLabels))

  const paged = paginate(filteredJobs, page, 8)
  const activeFilters = getActiveFilters(params)
  const courseOptions = buildCourseFilterOptions(jobs)

  return (
    <>
      {error && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Showing saved placement records while live records are unavailable.
        </div>
      )}
      {!loading && !error && source === 'api' && jobs.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          No confirmed placement records exist yet.
        </div>
      )}
      <PipelineFilters
        search={searchValue}
        stage={stage}
        semester={semester}
        course={course}
        courseOptions={courseOptions}
        sort={sort}
        status={status}
        action={action}
        outcome={outcome}
        employer={employer}
        waiting={waiting}
      />
      <ActiveFilterChips filters={activeFilters} params={params} />
      <PlacementQueue
        rows={paged.rows}
        visibleCount={filteredJobs.length}
        totalCount={jobs.length}
        returnTo={currentJobsHref}
        studentLabels={studentLabels}
      />
      <Pagination
        page={paged.page}
        totalPages={paged.totalPages}
        getHref={(nextPage) => pageHref(params, nextPage)}
      />
    </>
  )
}

function PipelineFilters({
  search,
  stage,
  semester,
  course,
  courseOptions,
  sort,
  status,
  action,
  outcome,
  employer,
  waiting,
}: {
  search?: string
  stage?: string
  semester?: string
  course?: string
  courseOptions: string[]
  sort: string
  status?: string
  action?: string
  outcome?: string
  employer?: string
  waiting?: string
}) {
  return (
    <form
      method="get"
      className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="grid gap-3 lg:grid-cols-5">
        <label className="grid gap-1 lg:col-span-2">
          <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">Search</span>
          <input
            name="search"
            defaultValue={search}
            placeholder="Student, employer, or role"
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm transition-colors outline-none focus:border-red-500"
          />
        </label>
        <FilterSelect name="stage" label="Stage" value={stage} options={stageOptions} />
        <FilterSelect
          name="semester"
          label="Semester"
          value={semester}
          options={[
            { label: 'All semesters', value: 'all' },
            ...semesters.map((item) => ({ label: item, value: item })),
          ]}
        />
        <CourseKeywordFilter value={course} options={courseOptions} />
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_auto] lg:items-end">
        <FilterSelect name="sort" label="Sort" value={sort} options={sortOptions} />
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="h-10 rounded-xl bg-red-700 px-4 text-sm font-bold text-white transition-colors hover:bg-red-800"
          >
            Apply
          </button>
          <Link
            href="/coordinator/jobs"
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100"
          >
            Reset
          </Link>
        </div>
      </div>
      <details className="rounded-xl border border-slate-200 bg-slate-50">
        <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-800">
          More filters
        </summary>
        <div className="grid gap-3 border-t border-slate-200 p-4 lg:grid-cols-5">
          <FilterSelect name="status" label="Status" value={status} options={statusOptions} />
          <FilterSelect name="action" label="Action state" value={action} options={actionOptions} />
          <FilterSelect name="outcome" label="Outcome" value={outcome} options={outcomeOptions} />
          <FilterSelect
            name="waiting"
            label="Waiting / overdue"
            value={waiting}
            options={waitingOptions}
          />
          <label className="grid gap-1">
            <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">
              Employer
            </span>
            <input
              name="employer"
              defaultValue={employer}
              placeholder="Employer name"
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm transition-colors outline-none focus:border-red-500"
            />
          </label>
        </div>
      </details>
    </form>
  )
}

function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string
  label: string
  value?: string
  options: Array<{ label: string; value: string }>
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">{label}</span>
      <select
        name={name}
        defaultValue={value ?? 'all'}
        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm transition-colors outline-none focus:border-red-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function CourseKeywordFilter({ value, options }: { value?: string; options: string[] }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">
        Course, Program, or Subject
      </span>
      <input
        name="course"
        defaultValue={value === 'all' ? '' : value}
        list="placement-course-options"
        placeholder="All courses/programs/subjects"
        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm transition-colors outline-none focus:border-red-500"
      />
      <datalist id="placement-course-options">
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </label>
  )
}

function ActiveFilterChips({
  filters,
  params,
}: {
  filters: Array<{ key: string; label: string; value: string }>
  params: URLSearchParams
}) {
  if (filters.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => (
        <Link
          key={filter.key}
          href={removeFilterHref(params, filter.key)}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-red-200"
        >
          {filter.label}: {filter.value}
          <X className="h-3 w-3" />
        </Link>
      ))}
      <Link href="/coordinator/jobs" className="text-xs font-bold text-red-700 hover:text-red-800">
        Clear all filters
      </Link>
    </div>
  )
}

function PlacementQueue({
  rows,
  visibleCount,
  totalCount,
  returnTo,
  studentLabels,
}: {
  rows: PlacementCase[]
  visibleCount: number
  totalCount: number
  returnTo: string
  studentLabels: Record<string, string>
}) {
  return (
    <SurfaceCard className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Active Placements</h2>
          <p className="text-sm text-slate-500">
            Showing {visibleCount} of {totalCount} post-offer placement{' '}
            {totalCount === 1 ? 'record' : 'records'}.
          </p>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            No confirmed placements match these filters.
          </div>
        )}
        {rows.map((job) => (
          <PlacementQueueRow
            key={job.id}
            job={job}
            returnTo={returnTo}
            studentLabels={studentLabels}
          />
        ))}
      </div>
    </SurfaceCard>
  )
}

function PlacementQueueRow({
  job,
  returnTo,
  studentLabels,
}: {
  job: PlacementCase
  returnTo: string
  studentLabels: Record<string, string>
}) {
  const reviewHref = withReviewReturn(job.reviewHref, returnTo, {
    context: PLACEMENT_PROCESSING_CONTEXT,
  })
  const waitingDays = getWaitingDays(job.submissionDate)
  const actionRequired = isActionRequired(job)
  const completed = job.status === 'approved' || job.status === 'rejected'
  const studentLabel = placementStudentLabel(job, studentLabels)

  return (
    <div
      className={[
        'grid gap-4 px-5 py-4 xl:grid-cols-[minmax(260px,1.05fr)_minmax(180px,0.65fr)_minmax(380px,1.25fr)_auto] xl:items-center',
        actionRequired ? 'bg-red-50/35' : 'bg-white',
      ].join(' ')}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-bold text-slate-950">{job.jobTitle}</p>
          <StatusBadge status={job.status} />
        </div>
        <p className="mt-1 text-sm text-slate-500">{studentLabel}</p>
      </div>

      <div className="grid gap-2 text-sm">
        <div>
          <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Program</p>
          <p className="mt-1 font-semibold text-slate-800">{job.course || 'Program pending'}</p>
        </div>
        <div>
          <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Semester</p>
          <p className="mt-1 font-semibold text-slate-800">{job.semester || 'Not supplied'}</p>
        </div>
      </div>

      <div className="space-y-2">
        <ProcessingTracker job={job} />
        <div className="text-xs font-semibold text-slate-500">
          <span className={actionRequired ? 'text-red-800' : undefined}>
            {completed
              ? `${job.status === 'approved' ? 'Approved' : 'Rejected'} ${formatDate(job.submissionDate)}`
              : waitingDays === 0
                ? 'Submitted today'
                : `Waiting ${waitingDays} day${waitingDays === 1 ? '' : 's'}`}
          </span>
        </div>
      </div>

      <Link
        href={reviewHref}
        className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-black"
      >
        {completed ? 'View' : 'Review'}
      </Link>
    </div>
  )
}

function placementStudentLabel(job: PlacementCase, studentLabels: Record<string, string>) {
  const resolvedLabel = job.studentUserId ? studentLabels[job.studentUserId] : undefined
  if (resolvedLabel && resolvedLabel !== STUDENT_PROFILE_PENDING) return resolvedLabel

  return formatStudentDisplay({
    studentId: job.studentId,
    name: job.studentName,
  })
}

function ProcessingTracker({ job }: { job: SelfSourcedJob }) {
  const steps = [
    'Placement Confirmed',
    'Documents Submitted',
    'Contract Review',
    'Final Approval',
    job.status === 'rejected' ? 'Rejected' : 'Approved',
  ]
  const currentIndex = getProcessingStepIndex(job)
  const isRejected = job.status === 'rejected'

  return (
    <div className="overflow-x-auto rounded-xl bg-slate-50 px-3 py-3">
      <div className="grid min-w-[520px] grid-cols-5 items-start gap-x-5">
        {steps.map((step, index) => {
          const complete = index < currentIndex || job.status === 'approved'
          const current = index === currentIndex
          const connectorComplete = index < currentIndex || job.status === 'approved'
          return (
            <div
              key={step}
              className="relative flex min-w-0 flex-col items-center gap-2 text-center"
            >
              {index > 0 && (
                <div
                  className={[
                    'absolute top-3 right-[calc(50%+17px)] left-[-20px] h-0.5',
                    connectorComplete ? 'bg-slate-950' : 'bg-slate-200',
                  ].join(' ')}
                />
              )}
              {index < steps.length - 1 && (
                <div
                  className={[
                    'absolute top-3 right-[-20px] left-[calc(50%+17px)] h-0.5',
                    connectorComplete ? 'bg-slate-950' : 'bg-slate-200',
                  ].join(' ')}
                />
              )}
              <span
                className={[
                  'relative z-10 flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold',
                  isRejected && current
                    ? 'border-red-700 bg-red-700 text-white'
                    : complete
                      ? 'border-slate-950 bg-slate-950 text-white'
                      : current
                        ? 'border-red-700 bg-white text-red-700 ring-2 ring-red-100'
                        : 'border-slate-300 bg-white text-slate-400',
                ].join(' ')}
              >
                {complete ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : current ? (
                  <span className="h-2 w-2 rounded-full bg-current" />
                ) : null}
              </span>
              <span
                className={[
                  'max-w-[86px] text-center text-[10px] leading-3 font-bold whitespace-normal',
                  current || complete ? 'text-slate-950' : 'text-slate-400',
                ].join(' ')}
              >
                {step}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function getCurrentStageId(job: SelfSourcedJob): WorkflowStageId {
  if ('workflowKind' in job && job.workflowKind === 'contract') {
    if (job.status === 'changes_requested' || job.status === 'awaiting_documents')
      return 'documents'
    if (job.status === 'approved') return 'approved'
    if (job.status === 'rejected') return 'rejected'
    return 'verification'
  }
  if (job.status === 'changes_requested' || job.status === 'awaiting_documents') return 'documents'
  if (
    job.status === 'flagged' ||
    job.status === 'awaiting_review' ||
    job.status === 'awaiting_placement_approval'
  )
    return 'review'
  if (job.status === 'pending' || job.status === 'awaiting_approval') return 'review'
  if (job.status === 'approved') return 'approved'
  if (job.status === 'rejected') return 'rejected'
  return 'submitted'
}

function getProcessingStepIndex(job: SelfSourcedJob) {
  if (job.status === 'approved' || job.status === 'rejected') return 4
  if ('workflowKind' in job && job.workflowKind === 'contract') return 2
  if (
    job.status === 'flagged' ||
    job.status === 'pending' ||
    job.status === 'awaiting_review' ||
    job.status === 'awaiting_placement_approval' ||
    job.status === 'awaiting_approval'
  ) {
    return 3
  }
  if (job.status === 'changes_requested' || job.status === 'awaiting_documents') return 1
  return 0
}

function getWaitingDays(date: string) {
  const diff = Date.now() - Date.parse(date)
  if (!Number.isFinite(diff) || diff < 0) return 0
  return Math.floor(diff / 86_400_000)
}

function isTerminal(job: SelfSourcedJob) {
  return job.status === 'approved' || job.status === 'rejected'
}

function isOverdue(job: SelfSourcedJob) {
  return !isTerminal(job) && getWaitingDays(job.submissionDate) >= 5
}

function isActionRequired(job: SelfSourcedJob) {
  if (isTerminal(job)) return false
  return (
    job.status === 'pending' ||
    job.status === 'awaiting_review' ||
    job.status === 'awaiting_placement_approval' ||
    job.status === 'awaiting_contract_review' ||
    job.status === 'awaiting_documents' ||
    job.status === 'awaiting_approval' ||
    job.status === 'flagged' ||
    job.status === 'changes_requested' ||
    isOverdue(job)
  )
}

function matchesActionFilter(job: SelfSourcedJob, action?: string) {
  if (!action || action === 'all') return true
  if (action === 'required') return isActionRequired(job)
  if (action === 'clear') return !isActionRequired(job)
  return true
}

function matchesOutcomeFilter(job: SelfSourcedJob, outcome?: string) {
  if (!outcome || outcome === 'all') return true
  if (outcome === 'active') return !isTerminal(job)
  if (outcome === 'closed') return isTerminal(job)
  if (outcome === 'approved') return job.status === 'approved'
  if (outcome === 'rejected') return job.status === 'rejected'
  return true
}

function matchesCourseFilter(job: SelfSourcedJob, course?: string) {
  if (!course || course === 'all') return true
  const needle = normalizeForSearch(course)
  if (!needle) return true
  return getCourseSearchValues(job).some((value) => normalizeForSearch(value).includes(needle))
}

function matchesWaitingFilter(job: SelfSourcedJob, waiting?: string) {
  if (!waiting || waiting === 'all') return true
  if (waiting === 'overdue') return isOverdue(job)
  if (waiting === 'waiting') return !isTerminal(job) && getWaitingDays(job.submissionDate) > 0
  if (waiting === 'today') return getWaitingDays(job.submissionDate) === 0
  return true
}

function compareQueueItems(
  a: PlacementCase,
  b: PlacementCase,
  sort: string,
  studentLabels: Record<string, string>
) {
  const newestFirst = dateValue(b.submissionDate) - dateValue(a.submissionDate)
  const oldestFirst = dateValue(a.submissionDate) - dateValue(b.submissionDate)

  switch (sort) {
    case 'newest':
    case 'recently_updated':
      return newestFirst
    case 'oldest':
    case 'oldest_waiting':
      return oldestFirst
    case 'stage':
      return stageRank(a) - stageRank(b) || oldestFirst
    case 'student':
      return (
        placementStudentLabel(a, studentLabels).localeCompare(
          placementStudentLabel(b, studentLabels)
        ) || newestFirst
      )
    case 'employer':
      return a.company.localeCompare(b.company) || newestFirst
    case 'action_required':
    default:
      return (
        Number(isActionRequired(b)) - Number(isActionRequired(a)) ||
        Number(isOverdue(b)) - Number(isOverdue(a)) ||
        Number(isTerminal(a)) - Number(isTerminal(b)) ||
        newestFirst
      )
  }
}

function dateValue(date: string) {
  const value = Date.parse(date)
  return Number.isFinite(value) ? value : 0
}

function stageRank(job: SelfSourcedJob) {
  const order: Record<WorkflowStageId, number> = {
    submitted: 1,
    documents: 2,
    review: 3,
    verification: 4,
    approved: 5,
    rejected: 6,
  }
  return order[getCurrentStageId(job)]
}

function buildCourseFilterOptions(jobs: SelfSourcedJob[]) {
  const options = new Set<string>()

  jobs.forEach((job) => {
    getCourseOptionValues(job).forEach((value) => {
      if (isSuppliedCourseValue(value)) {
        options.add(value)
      }
    })
  })

  return [...options].sort((a, b) => a.localeCompare(b))
}

function getCourseSearchValues(job: SelfSourcedJob) {
  return [
    job.course,
    job.semester,
    job.jobTitle,
    job.description,
    ...job.notes,
    ...job.concerns,
  ].filter(Boolean)
}

function getCourseOptionValues(job: SelfSourcedJob) {
  return [job.course, ...splitCourseParts(job.course)]
}

function splitCourseParts(value: string) {
  return value
    .split(' - ')
    .map((part) => part.trim())
    .filter(Boolean)
}

function isSuppliedCourseValue(value: string) {
  const normalized = normalizeForSearch(value)
  return normalized !== '' && normalized !== 'program pending' && normalized !== 'not supplied'
}

function normalizeForSearch(value: string) {
  return value.trim().toLowerCase()
}

function getActiveFilters(params: URLSearchParams) {
  const filters: Array<{ key: string; label: string; value: string }> = []
  const definitions = [
    { key: 'search', label: 'Search' },
    { key: 'stage', label: 'Stage', options: stageOptions },
    { key: 'semester', label: 'Semester' },
    { key: 'course', label: 'Course/Program' },
    { key: 'status', label: 'Status', options: statusOptions },
    { key: 'action', label: 'Action', options: actionOptions },
    { key: 'outcome', label: 'Outcome', options: outcomeOptions },
    { key: 'employer', label: 'Employer' },
    { key: 'waiting', label: 'Waiting', options: waitingOptions },
  ]

  definitions.forEach((definition) => {
    const value = params.get(definition.key)
    if (!value || value === 'all') return
    filters.push({
      key: definition.key,
      label: definition.label,
      value: definition.options ? optionLabel(definition.options, value) : value,
    })
  })

  const sort = params.get('sort')
  if (sort && sort !== 'action_required') {
    filters.push({
      key: 'sort',
      label: 'Sort',
      value: optionLabel(sortOptions, sort),
    })
  }

  return filters
}

function optionLabel(options: Array<{ label: string; value: string }>, value: string) {
  return options.find((option) => option.value === value)?.label ?? value
}
