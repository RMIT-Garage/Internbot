'use client'

import Link from 'next/link'
import { CalendarDays, RefreshCw } from 'lucide-react'
import { Skeleton } from '@/components/ui/ContentSkeleton'
import {
  CHIP_TONE_CLASSES,
  deriveStudentSemesterChip,
  formatSemesterLabel,
} from '@/lib/semester/display'
import type { SemesterResponse } from '@/types/api'
import type { UserWorkflowResponse } from '@/api/models/UserWorkflowResponse'

interface SemesterContextBarProps {
  loading?: boolean
  semester: SemesterResponse | null
  workflow?: UserWorkflowResponse | null
  placementSemesterLabel?: string | null
  canChangeSemester?: boolean
  className?: string
}

export function SemesterContextBar({
  loading = false,
  semester,
  workflow,
  placementSemesterLabel = null,
  canChangeSemester = true,
  className = '',
}: SemesterContextBarProps) {
  if (loading) {
    return (
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm ${className}`}
      >
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </div>
    )
  }

  const chip = deriveStudentSemesterChip({
    semester,
    semesterEnrolmentState: workflow?.semesterEnrolmentState,
    internshipStatus: workflow?.internshipStatus,
  })

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm ${className}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50">
          <CalendarDays className="h-4 w-4 text-red-600" />
        </div>
        <div className="min-w-0">
          {semester ? (
            <>
              <p className="truncate text-sm font-semibold text-slate-950">
                {formatSemesterLabel(semester)}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${CHIP_TONE_CLASSES[chip.tone]}`}
                >
                  {chip.label}
                </span>
                {semester.semesterCode && (
                  <span className="text-xs text-slate-500">{semester.semesterCode}</span>
                )}
              </div>
            </>
          ) : placementSemesterLabel && workflow?.internshipStatus === 'offer_approved' ? (
            <>
              <p className="truncate text-sm font-semibold text-slate-950">
                {placementSemesterLabel}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${CHIP_TONE_CLASSES[chip.tone]}`}
                >
                  {chip.label}
                </span>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-950">No semester selected</p>
              <p className="text-xs text-slate-500">
                Choose a semester to browse opportunities and apply.
              </p>
            </>
          )}
        </div>
      </div>

      {canChangeSemester ? (
        <Link
          href={semester ? '/student/opportunities?change=1' : '/student/semesters'}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {semester ? 'Change semester' : 'Select semester'}
        </Link>
      ) : (
        <span className="shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
          Placement confirmed
        </span>
      )}
    </div>
  )
}
