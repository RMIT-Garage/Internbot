'use client'

import { CalendarDays, CheckCircle2 } from 'lucide-react'
import type { SemesterResponse } from '@/types/api'
import { formatSemesterEnrolmentWindow, studentSemesterPhaseLabel } from '@/lib/semester/display'
import {
  canStudentEnrollInSemester,
  canStudentSelectSemester,
} from '@/lib/semester/studentSemesters'
import { isEnrolmentWindowOpen } from '@/lib/semester/display'
import { SurfaceCard } from '@/components/student/Premium'
import { Skeleton } from '@/components/ui/ContentSkeleton'
import { cn } from '@/lib/utils'

function semesterBadgeLabel(sem: SemesterResponse, selectable: boolean) {
  if (selectable && !isEnrolmentWindowOpen(sem)) {
    return 'Enrollment open'
  }
  return studentSemesterPhaseLabel(sem.status)
}

function semesterBadgeClasses(sem: SemesterResponse, selectable: boolean) {
  if (selectable && !isEnrolmentWindowOpen(sem)) {
    return 'bg-amber-50 text-amber-700'
  }
  if (sem.status === 'enrollment_open') return 'bg-green-50 text-green-700'
  if (sem.status === 'placement_running' || sem.status === 'reporting') {
    return 'bg-amber-50 text-amber-700'
  }
  return 'bg-gray-100 text-gray-500'
}

export function SemesterPickerGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <SurfaceCard key={i} className="p-6">
          <div className="flex items-start justify-between">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-5 rounded-full" />
          </div>
          <Skeleton className="mt-5 h-6 w-36" />
          <Skeleton className="mt-2 h-3 w-28" />
        </SurfaceCard>
      ))}
    </div>
  )
}

export function SemesterPickerEmptyState() {
  return (
    <SurfaceCard className="flex flex-col items-center py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
        <CalendarDays className="h-6 w-6 text-gray-400" />
      </div>
      <p className="mt-4 text-sm font-semibold text-gray-600">No semesters available</p>
      <p className="mt-1 max-w-sm text-xs text-gray-400">
        None are open for enrollment right now. Check back later or contact your coordinator.
      </p>
    </SurfaceCard>
  )
}

interface SemesterPickerGridProps {
  semesters: readonly SemesterResponse[]
  selectedSemesterId: string | null
  onSelect: (semesterId: string) => void
  /**
   * When true (default), semesters with `enrollment_open` are selectable even if the
   * calendar enrolment window has ended. Non-open statuses stay disabled.
   */
  allowClosedWindowSelection?: boolean
  className?: string
  columns?: 'two' | 'three'
}

export function SemesterPickerGrid({
  semesters,
  selectedSemesterId,
  onSelect,
  allowClosedWindowSelection = true,
  className,
  columns = 'three',
}: SemesterPickerGridProps) {
  if (semesters.length === 0) {
    return <SemesterPickerEmptyState />
  }

  return (
    <div
      className={cn(
        'grid gap-4',
        columns === 'two' ? 'sm:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3',
        className
      )}
    >
      {semesters.map((sem) => {
        const selectable = allowClosedWindowSelection
          ? canStudentSelectSemester(sem)
          : canStudentEnrollInSemester(sem)
        const isSelected = selectedSemesterId === sem.id

        return (
          <button
            key={sem.id}
            type="button"
            onClick={() => selectable && onSelect(sem.id)}
            disabled={!selectable}
            className={cn(
              'w-full rounded-2xl border p-6 text-left transition',
              !selectable && 'cursor-not-allowed opacity-60',
              isSelected && selectable
                ? 'border-red-500 bg-red-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  semesterBadgeClasses(sem, selectable)
                )}
              >
                {semesterBadgeLabel(sem, selectable)}
              </span>
              <div
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition',
                  isSelected && selectable ? 'border-red-500 bg-red-500' : 'border-gray-300'
                )}
              >
                {isSelected && selectable && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-white" aria-hidden />
                )}
              </div>
            </div>
            <p className="mt-4 text-lg font-bold text-gray-900">{sem.displayName}</p>
            <p className="mt-0.5 text-sm text-gray-500">
              {sem.semesterCode}
              {sem.courseCode ? ` · ${sem.courseCode}` : ''}
            </p>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatSemesterEnrolmentWindow(sem)}
            </p>
            {selectable && !isEnrolmentWindowOpen(sem) && (
              <p className="mt-2 text-xs text-amber-700">
                Outside enrolment dates — you can still select
              </p>
            )}
          </button>
        )
      })}
    </div>
  )
}

interface EnrolledSemesterCardProps {
  semester: SemesterResponse | null
  loading?: boolean
  changeLabel?: string
  onChange: () => void
}

/** Compact enrolled-semester summary (profile) — matches selected picker card styling. */
export function EnrolledSemesterCard({
  semester,
  loading,
  changeLabel = 'Change semester',
  onChange,
}: EnrolledSemesterCardProps) {
  if (loading) {
    return (
      <SurfaceCard className="p-6">
        <Skeleton className="h-5 w-28 rounded-full" />
        <Skeleton className="mt-5 h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-32" />
        <Skeleton className="mt-6 h-10 w-36 rounded-xl" />
      </SurfaceCard>
    )
  }

  if (!semester) {
    return (
      <SurfaceCard className="flex flex-col items-center px-6 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <CalendarDays className="h-5 w-5 text-gray-400" />
        </div>
        <p className="mt-3 text-sm font-semibold text-gray-700">No semester selected</p>
        <p className="mt-1 text-xs text-gray-500">
          Choose a teaching period to browse opportunities and apply.
        </p>
        <button
          type="button"
          onClick={onChange}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700"
        >
          Choose semester
        </button>
      </SurfaceCard>
    )
  }

  const selectable = canStudentSelectSemester(semester)

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/60 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-semibold',
            semesterBadgeClasses(semester, selectable)
          )}
        >
          {semesterBadgeLabel(semester, selectable)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
          <CheckCircle2 className="h-3 w-3" aria-hidden />
          Active on profile
        </span>
      </div>
      <p className="mt-4 text-lg font-bold text-gray-900">{semester.displayName}</p>
      <p className="mt-0.5 text-sm text-gray-600">
        {semester.semesterCode}
        {semester.courseCode ? ` · ${semester.courseCode}` : ''}
      </p>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
        <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
        {formatSemesterEnrolmentWindow(semester)}
      </p>
      <button
        type="button"
        onClick={onChange}
        className="mt-5 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50"
      >
        {changeLabel}
      </button>
    </div>
  )
}
