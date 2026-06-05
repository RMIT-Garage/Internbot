'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import {
  CoordinatorPageHeader,
  SurfaceCard,
  SurfaceCardHeader,
} from '@/components/coordinator/Premium'
import CoordinatorContentSkeleton from '@/components/coordinator/CoordinatorContentSkeleton'
import { listSemesterStudents } from '@/lib/coordinator/api'
import type { SemesterStudentItem, SemesterStudentPlacementStatus } from '@/types/api'

const PLACEMENT_STATUS_LABELS: Record<SemesterStudentPlacementStatus, string> = {
  no_applications: 'No Applications',
  browsing: 'Browsing',
  offer_in_review: 'Offer in Review',
  offer_changes_requested: 'Changes Requested',
  offer_approved: 'Offer Approved',
  all_rejected: 'All Rejected',
}

function semesterStudentsHref(semesterId: string) {
  const params = new URLSearchParams({ semesterId })
  return `/coordinator/semesters/students?${params.toString()}`
}

function semesterStudentProfileHref(student: SemesterStudentItem, returnTo: string) {
  const params = new URLSearchParams({
    id: student.userId,
    returnTo,
    placementStatus: student.placementStatus,
  })
  if (student.programCode) params.set('programCode', student.programCode)
  return `/coordinator/students/view?${params.toString()}`
}

const PLACEMENT_STATUS_COLORS: Record<SemesterStudentPlacementStatus, string> = {
  no_applications: 'text-slate-400',
  browsing: 'text-slate-600',
  offer_in_review: 'text-amber-600',
  offer_changes_requested: 'text-red-600',
  offer_approved: 'text-emerald-600 font-semibold',
  all_rejected: 'text-red-700 font-semibold',
}

export default function SemesterStudentsClient() {
  const searchParams = useSearchParams()
  const semesterId = searchParams.get('semesterId')?.trim() ?? ''
  const returnTo = semesterId ? semesterStudentsHref(semesterId) : '/coordinator/semesters'
  const [students, setStudents] = useState<SemesterStudentItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filterStatus, setFilterStatus] = useState<SemesterStudentPlacementStatus | ''>('')
  const [filterProgram, setFilterProgram] = useState('')

  useEffect(() => {
    if (!semesterId) {
      setLoading(false)
      setStudents([])
      setTotalCount(0)
      setNextPageToken(null)
      return
    }

    setLoading(true)
    const query: Record<string, string> = {}
    if (filterStatus) query['placementStatus'] = filterStatus
    if (filterProgram.trim()) query['programCode'] = filterProgram.trim()

    listSemesterStudents(semesterId, query)
      .then((res) => {
        setStudents(res.items)
        setTotalCount(res.totalCount)
        setNextPageToken(res.nextPageToken)
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to load students.')
      })
      .finally(() => setLoading(false))
  }, [semesterId, filterStatus, filterProgram])

  async function loadMore() {
    if (!nextPageToken || !semesterId) return
    setLoadingMore(true)
    const query: Record<string, string> = { pageToken: nextPageToken }
    if (filterStatus) query['placementStatus'] = filterStatus
    if (filterProgram.trim()) query['programCode'] = filterProgram.trim()
    try {
      const res = await listSemesterStudents(semesterId, query)
      setStudents((prev) => [...prev, ...res.items])
      setNextPageToken(res.nextPageToken)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load more students.')
    } finally {
      setLoadingMore(false)
    }
  }

  if (!semesterId) {
    return (
      <div className="space-y-6">
        <Link
          href="/coordinator/semesters"
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Semesters
        </Link>
        <SurfaceCard className="p-8 text-center text-sm text-slate-600">
          <p className="font-semibold text-slate-950">Semester not specified</p>
          <p className="mt-2">Open enrolled students from a semester card on the Semesters page.</p>
          <Link
            href="/coordinator/semesters"
            className="mt-4 inline-flex rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800"
          >
            Go to Semesters
          </Link>
        </SurfaceCard>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/coordinator/semesters"
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Semesters
        </Link>
        <CoordinatorPageHeader
          eyebrow="Semester Students"
          title="Enrolled Students"
          description={`${totalCount} student${totalCount !== 1 ? 's' : ''} enrolled in this semester.`}
        />
      </div>

      <SurfaceCard className="p-4">
        <div className="flex flex-wrap gap-3">
          <label className="grid gap-1 text-xs font-bold tracking-wide text-slate-500 uppercase">
            Placement Status
            <select
              value={filterStatus}
              onChange={(e) =>
                setFilterStatus(e.target.value as SemesterStudentPlacementStatus | '')
              }
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 normal-case outline-none focus:border-red-500"
            >
              <option value="">All statuses</option>
              {(Object.keys(PLACEMENT_STATUS_LABELS) as SemesterStudentPlacementStatus[]).map(
                (s) => (
                  <option key={s} value={s}>
                    {PLACEMENT_STATUS_LABELS[s]}
                  </option>
                )
              )}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold tracking-wide text-slate-500 uppercase">
            Program Code
            <input
              type="text"
              value={filterProgram}
              placeholder="e.g. BP094"
              onChange={(e) => setFilterProgram(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-900 normal-case outline-none focus:border-red-500"
            />
          </label>
        </div>
      </SurfaceCard>

      {loading ? (
        <CoordinatorContentSkeleton title="Loading students..." />
      ) : (
        <SurfaceCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold tracking-wide text-slate-500 uppercase">
                <tr>
                  {[
                    'Name',
                    'Student Number',
                    'Program',
                    'Enrolled At',
                    'Placement Status',
                    'Applications',
                    '',
                  ].map((head, i) => (
                    <th key={i} className="px-5 py-3">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                      No students found.
                    </td>
                  </tr>
                ) : (
                  students.map((student) => (
                    <tr key={student.userId} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-900">
                        {student.displayName ?? student.userId}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{student.studentNumber ?? '—'}</td>
                      <td className="px-5 py-3 text-slate-600">{student.programCode ?? '—'}</td>
                      <td className="px-5 py-3 text-slate-600">
                        {student.semesterSelectedAt
                          ? new Intl.DateTimeFormat('en-AU', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            }).format(new Date(student.semesterSelectedAt))
                          : '—'}
                      </td>
                      <td
                        className={`px-5 py-3 ${PLACEMENT_STATUS_COLORS[student.placementStatus]}`}
                      >
                        {PLACEMENT_STATUS_LABELS[student.placementStatus]}
                      </td>
                      <td className="px-5 py-3 text-slate-900">{student.internshipCount}</td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={semesterStudentProfileHref(student, returnTo)}
                          className="text-sm font-bold text-red-700 hover:text-red-800"
                        >
                          View Profile
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {nextPageToken && (
            <div className="border-t border-slate-200 px-5 py-3">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="text-sm font-medium text-red-700 hover:text-red-900 disabled:opacity-60"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </SurfaceCard>
      )}
    </div>
  )
}
