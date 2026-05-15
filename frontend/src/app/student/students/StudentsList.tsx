'use client'

import { useSearchParams } from 'next/navigation'
import { FilterBar } from '@/components/coordinator/FilterBar'
import { Pagination } from '@/components/coordinator/Pagination'
import { SurfaceCard } from '@/components/coordinator/Premium'
import { StatusBadge } from '@/components/coordinator/StatusBadge'
import { coordinatorStudents, courses, semesters } from '@/lib/coordinator/mockData'
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

  const filteredStudents = students
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

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        {(loading || error) && (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            {loading
              ? 'Loading student workflow records from the internships API...'
              : `Using isolated fallback data: ${error}`}
          </div>
        )}
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Directory source: {source === 'api' ? 'API-derived internship records' : 'fallback data'}
        </div>
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
                    Name
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Student ID
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Course
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Semester
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Overall Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.rows.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div>
                        <p className="font-bold text-slate-950">{student.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{student.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-medium whitespace-nowrap text-slate-700">
                      {student.studentId}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-slate-600">{student.course}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-slate-600">
                      {student.semester}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <StatusBadge status={student.overallStatus} />
                    </td>
                  </tr>
                ))}
                {paged.rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
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
          <h2 className="font-bold text-slate-950">Cohort Analytics</h2>
          <div className="mt-4 space-y-4">
            {[
              [
                'On track',
                students.filter((student) => student.overallStatus === 'on_track').length,
              ],
              [
                'Needs attention',
                students.filter((student) => student.overallStatus === 'needs_attention').length,
              ],
              [
                'Approved',
                students.filter((student) => student.overallStatus === 'approved').length,
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
          <h2 className="font-bold text-slate-950">Audit Freshness</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            84% of active students have a coordinator or system audit entry within the last seven
            days.
          </p>
        </SurfaceCard>
      </aside>
    </div>
  )
}
