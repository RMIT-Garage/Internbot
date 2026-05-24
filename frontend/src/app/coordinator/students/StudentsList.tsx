'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { FilterBar } from '@/components/coordinator/FilterBar'
import { CoordinatorContentSkeleton } from '@/components/coordinator/CoordinatorContentSkeleton'
import { Pagination } from '@/components/coordinator/Pagination'
import { SurfaceCard } from '@/components/coordinator/Premium'
import { StatusBadge } from '@/components/coordinator/StatusBadge'
import {
  coordinatorStudents,
  courses,
  semesters,
  type CoordinatorStudent,
} from '@/lib/coordinator/mockData'
import { matchesParam, paginate } from '@/lib/coordinator/listUtils'
import { useCoordinatorApiResource } from '@/hooks/useCoordinatorApiResource'
import { listInternships } from '@/lib/coordinator/api'
import { deriveStudentsFromInternships } from '@/lib/coordinator/apiMappers'

const statusOptions = [
  { label: 'All statuses', value: 'all' },
  { label: 'On track', value: 'on_track' },
  { label: 'Needs attention', value: 'needs_attention' },
  { label: 'Approved', value: 'approved' },
  { label: 'Inactive', value: 'inactive' },
]

function pageHref(searchParams: URLSearchParams, page: number) {
  const params = new URLSearchParams(searchParams)
  params.set('page', String(page))
  return `?${params.toString()}`
}

export function StudentsList() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const params = new URLSearchParams(searchParams)
  const status = params.get('status') ?? undefined
  const semester = params.get('semester') ?? undefined
  const course = params.get('course') ?? undefined
  const searchValue = params.get('search') ?? undefined
  const normalizedSearch = searchValue?.toLowerCase()
  const page = Number(params.get('page') ?? '1')
  const {
    data: students,
    loading,
    error,
    source,
  } = useCoordinatorApiResource(
    async () => {
      if (process.env.NODE_ENV === 'development') {
        console.debug(
          '[coordinator/students] backend filters: none; directory filters/search/page are client-side'
        )
      }
      const response = await listInternships({ limit: 100 })
      return deriveStudentsFromInternships(response.items)
    },
    coordinatorStudents,
    'students',
    { emptyData: [] }
  )

  if (loading) {
    return <CoordinatorContentSkeleton title="Loading students..." />
  }

  const stableStudents = ensureUniqueStudentRows(students)
  const filteredStudents = stableStudents
    .filter((student) => matchesParam(student.overallStatus, status))
    .filter((student) => matchesParam(student.semester, semester))
    .filter((student) => matchesParam(student.course, course))
    .filter((student) => {
      if (!normalizedSearch) {
        return true
      }

      return (
        student.name.toLowerCase().includes(normalizedSearch) ||
        student.studentId.toLowerCase().includes(normalizedSearch)
      )
    })

  const paged = paginate(filteredStudents, page, 4)
  const returnTo = `${pathname}${params.toString() ? `?${params.toString()}` : ''}`

  function studentHref(student: CoordinatorStudent) {
    const viewParams = new URLSearchParams({ id: student.id, rowId: student.rowId, returnTo })
    if (student.recordId) {
      viewParams.set('recordId', student.recordId)
    }
    return `/coordinator/students/view?${viewParams.toString()}`
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        {error && (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            {`Using isolated fallback data: ${error}`}
          </div>
        )}
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Directory source: {source === 'api' ? 'API-derived internship records' : 'fallback data'}
        </div>
        {!loading && !error && source === 'api' && stableStudents.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            Backend connected, but no records exist yet.
          </div>
        )}
        <FilterBar
          search={{
            name: 'search',
            label: 'Search',
            placeholder: 'Name or student ID',
            value: searchValue,
          }}
          selects={[
            {
              name: 'semester',
              label: 'Semester',
              value: semester,
              options: [
                { label: 'All semesters', value: 'all' },
                ...semesters.map((item) => ({ label: item, value: item })),
              ],
            },
            { name: 'status', label: 'Status', value: status, options: statusOptions },
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

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs font-bold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Student
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Internship
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Source
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Current Stage
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Risk
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Semester
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.rows.map((student) => {
                  const href = studentHref(student)

                  return (
                    <tr
                      key={student.rowId}
                      role="link"
                      tabIndex={0}
                      onClick={() => router.push(href)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          router.push(href)
                        }
                      }}
                      className="cursor-pointer transition hover:bg-slate-50/80 focus:bg-slate-50 focus:ring-2 focus:ring-red-700 focus:outline-none focus:ring-inset"
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div>
                          <p className="font-bold text-slate-950">{student.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{student.email}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-700">
                            {student.studentId}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div>
                          <p className="font-semibold text-slate-800">
                            {student.placementStatus || 'No placement yet'}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">{student.course}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <StudentMetaBadge label={studentSource(student)} />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-slate-700">
                        {studentStage(student)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <StudentRiskBadge label={studentRisk(student)} />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-slate-600">
                        {student.semester}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <StatusBadge status={student.overallStatus} />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm font-bold text-red-700">View profile</span>
                      </td>
                    </tr>
                  )
                })}
                {paged.rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-zinc-500">
                      No students match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Pagination
          page={paged.page}
          totalPages={paged.totalPages}
          getHref={(nextPage) => pageHref(params, nextPage)}
        />
      </div>

      <aside className="space-y-4">
        <SurfaceCard className="p-5">
          <h2 className="font-bold text-slate-950">WIL Monitoring</h2>
          <div className="mt-4 space-y-4">
            {[
              [
                'On track',
                stableStudents.filter((student) => student.overallStatus === 'on_track').length,
              ],
              [
                'Needs attention',
                stableStudents.filter((student) => student.overallStatus === 'needs_attention')
                  .length,
              ],
              [
                'Approved',
                stableStudents.filter((student) => student.overallStatus === 'approved').length,
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
              >
                <span className="text-sm font-medium text-slate-600">{label}</span>
                <span className="text-lg font-bold text-slate-950">{value}</span>
              </div>
            ))}
          </div>
        </SurfaceCard>
        <SurfaceCard className="p-5">
          <h2 className="font-bold text-slate-950">Operational Focus</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Student records show whether the student is still seeking an internship or has moved
            into post-offer placement processing.
          </p>
        </SurfaceCard>
      </aside>
    </div>
  )
}

function ensureUniqueStudentRows(students: CoordinatorStudent[]): CoordinatorStudent[] {
  const seen = new Map<string, number>()

  return students.map((student, index) => {
    const baseRowId =
      student.rowId || `${student.studentId || student.id}-${student.recordId ?? 'record'}`
    const seenCount = seen.get(baseRowId) ?? 0
    seen.set(baseRowId, seenCount + 1)

    if (seenCount === 0) {
      return { ...student, rowId: baseRowId }
    }

    return {
      ...student,
      rowId: `${baseRowId}-fallback-${index}`,
    }
  })
}

function StudentMetaBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
      {label}
    </span>
  )
}

function StudentRiskBadge({ label }: { label: string }) {
  const elevated = label !== 'No placement yet' && label !== 'On track'
  return (
    <span
      className={[
        'inline-flex rounded-full px-2.5 py-1 text-xs font-bold',
        elevated ? 'bg-red-50 text-red-800' : 'bg-slate-100 text-slate-700',
      ].join(' ')}
    >
      {label}
    </span>
  )
}

function studentSource(student: CoordinatorStudent) {
  const status = (student.placementStatus ?? '').toLowerCase()
  if (status.includes('self') || status.includes('review')) return 'Self-Sourced'
  if (status.includes('contract') || status.includes('accepted') || status.includes('approved')) {
    return 'Coordinator Opportunity'
  }
  return 'CareerHub'
}

function studentStage(student: CoordinatorStudent) {
  const status = (student.placementStatus ?? '').toLowerCase()
  if (!student.placementStatus) return 'Seeking Internship'
  if (status.includes('change')) return 'Documents Requested'
  if (status.includes('review')) return 'PD Review'
  if (status.includes('contract')) return 'Contract Review'
  if (status.includes('accepted') || status.includes('approved')) return 'Approved'
  if (status.includes('flag')) return 'Needs Follow-Up'
  return 'Seeking Internship'
}

function studentRisk(student: CoordinatorStudent) {
  const status = (student.placementStatus ?? '').toLowerCase()
  if (student.overallStatus === 'inactive') return 'No Placement Yet'
  if (status.includes('change')) return 'Missing Documents'
  if (status.includes('flag') || student.overallStatus === 'needs_attention')
    return 'Needs Follow-Up'
  if (student.lastAudit && getDaysSince(student.lastAudit) > 14) return 'Waiting >14 Days'
  return student.overallStatus === 'approved' ? 'On track' : 'No placement yet'
}

function getDaysSince(value: string) {
  const diff = Date.now() - Date.parse(value)
  if (!Number.isFinite(diff) || diff < 0) return 0
  return Math.floor(diff / 86_400_000)
}
