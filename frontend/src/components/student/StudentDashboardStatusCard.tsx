'use client'

import Link from 'next/link'
import { CalendarDays, ChevronRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/ContentSkeleton'
import {
  CHIP_TONE_CLASSES,
  deriveStudentDashboardStatus,
  formatSemesterEnrolmentWindow,
  formatSemesterLabel,
  formatSemesterShort,
  semesterEnrolmentStateLabel,
} from '@/lib/semester/display'
import type { SemesterResponse } from '@/types/api'
import type { UserWorkflowResponse } from '@/api/models/UserWorkflowResponse'
import type { CurrentWorkflowStep } from '@/api/models/CurrentWorkflowStep'

interface StudentDashboardStatusCardProps {
  loading?: boolean
  semester: SemesterResponse | null
  workflow: UserWorkflowResponse | null
  currentWorkflowStep?: CurrentWorkflowStep | string | null
  appliedCount?: number
  pendingReviewCount?: number
  placementSemesterLabel?: string | null
}

export function StudentDashboardStatusCard({
  loading = false,
  semester,
  workflow,
  currentWorkflowStep,
  appliedCount = 0,
  pendingReviewCount = 0,
  placementSemesterLabel = null,
}: StudentDashboardStatusCardProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
        </div>
      </div>
    )
  }

  const status = deriveStudentDashboardStatus({
    semester,
    workflow,
    currentWorkflowStep,
    appliedCount,
    pendingReviewCount,
    placementSemesterLabel,
  })

  const isPlacementConfirmed = workflow?.internshipStatus === 'offer_approved'

  const toneBorder =
    status.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50/50'
      : status.tone === 'warning'
        ? 'border-amber-200 bg-amber-50/40'
        : status.tone === 'active'
          ? 'border-blue-200 bg-blue-50/40'
          : 'border-slate-200 bg-white'

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${toneBorder}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50">
            <CalendarDays className="h-5 w-5 text-red-600" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                Your semester status
              </p>
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${CHIP_TONE_CLASSES[status.tone]}`}
              >
                {status.chipLabel}
              </span>
            </div>
            {semester ? (
              <>
                <p className="mt-1 text-base font-bold text-slate-950">{semester.displayName}</p>
                <p className="text-sm text-slate-600">{formatSemesterShort(semester)}</p>
              </>
            ) : placementSemesterLabel ? (
              <p className="mt-1 text-base font-bold text-slate-950">{placementSemesterLabel}</p>
            ) : (
              <p className="mt-1 text-sm font-semibold text-slate-950">No semester selected</p>
            )}
            {isPlacementConfirmed && workflow?.semesterEnrolmentState && (
              <p className="mt-2 text-sm font-medium text-emerald-800">
                {semesterEnrolmentStateLabel(workflow.semesterEnrolmentState)}
              </p>
            )}
            {semester && isPlacementConfirmed && (
              <p className="mt-1 text-xs text-slate-500">
                {formatSemesterEnrolmentWindow(semester)}
              </p>
            )}
            <h2 className="mt-2 text-lg font-bold text-slate-950">{status.headline}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{status.detail}</p>
          </div>
        </div>
        {!semester ? (
          <Link
            href="/student/semesters"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
          >
            Select semester
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : workflow?.internshipStatus === 'browsing_opportunities' ? (
          <Link
            href="/student/opportunities"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Browse opportunities
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : workflow?.internshipStatus === 'offer_approved' ? (
          <Link
            href="/student/applications"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-bold text-emerald-900 hover:bg-emerald-50"
          >
            My applications
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
    </div>
  )
}
