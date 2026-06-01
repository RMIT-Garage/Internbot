'use client'

import { CHIP_TONE_CLASSES, deriveStudentDashboardStatus } from '@/lib/semester/display'
import type { SemesterResponse } from '@/types/api'
import type { UserWorkflowResponse } from '@/api/models/UserWorkflowResponse'
import type { CurrentWorkflowStep } from '@/api/models/CurrentWorkflowStep'
import { SurfaceCard } from '@/components/student/Premium'
import { Skeleton } from '@/components/ui/ContentSkeleton'

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
      <SurfaceCard className="flex items-center justify-between gap-3 p-4">
        <Skeleton className="h-5 w-48 max-w-[70%]" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </SurfaceCard>
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

  const semesterTitle = semester?.displayName ?? placementSemesterLabel ?? 'No semester selected'

  return (
    <SurfaceCard className="flex flex-wrap items-center justify-between gap-3 p-4">
      <p className="min-w-0 text-base font-bold text-slate-950">{semesterTitle}</p>
      <span
        className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${CHIP_TONE_CLASSES[status.tone]}`}
      >
        {status.chipLabel}
      </span>
    </SurfaceCard>
  )
}
