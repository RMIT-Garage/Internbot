import type { SemesterResponse, SemesterStatus } from '@/types/api'
import type { SemesterEnrolmentState } from '@/api/models/SemesterEnrolmentState'
import type { InternshipStatus } from '@/api/models/InternshipStatus'
import type { CurrentWorkflowStep } from '@/api/models/CurrentWorkflowStep'
import type { UserWorkflowResponse } from '@/api/models/UserWorkflowResponse'

export const INTERNSHIP_STATUS_LABELS: Record<string, string> = {
  no_semester: 'Select a semester',
  browsing_opportunities: 'Applying',
  offer_in_review: 'Offer under review',
  offer_changes_requested: 'Changes requested',
  offer_approved: 'Enrolled — placement confirmed',
  all_rejected: 'No active applications',
}

const WORKFLOW_STEP_LABELS_MAP = {
  profile: 'Complete your profile',
  semester_selection: 'Select your semester',
  opportunity_browsing: 'Browse and apply',
  offer_stage: 'Offer in progress',
  completed: 'Enrolled for semester',
} as const

export const WORKFLOW_STEP_LABELS: Record<string, string> = WORKFLOW_STEP_LABELS_MAP

export function workflowStepLabel(step: string): string {
  return (
    WORKFLOW_STEP_LABELS_MAP[step as keyof typeof WORKFLOW_STEP_LABELS_MAP] ?? 'Internship workflow'
  )
}

export const SEMESTER_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  enrollment_open: 'Enrollment Open',
  placement_running: 'Placements in Progress',
  reporting: 'Reporting',
  archived: 'Archived',
  active: 'Active',
}

type ChipTone = 'neutral' | 'warning' | 'success' | 'muted' | 'active'

export function formatSemesterLabel(
  semester: Pick<SemesterResponse, 'displayName' | 'courseCode'>
) {
  return semester.courseCode
    ? `${semester.displayName} (${semester.courseCode})`
    : semester.displayName
}

export function formatSemesterShort(
  semester: Pick<SemesterResponse, 'displayName' | 'semesterCode' | 'courseCode'>
) {
  const code = semester.semesterCode
  return code && semester.courseCode ? `${code} · ${semester.courseCode}` : semester.displayName
}

export function semesterStatusLabel(status: SemesterStatus | string) {
  return SEMESTER_STATUS_LABELS[status] ?? status.replace(/_/g, ' ')
}

export function buildSemesterLabelMap(semesters: readonly SemesterResponse[]) {
  return Object.fromEntries(semesters.map((s) => [s.id, formatSemesterLabel(s)]))
}

export function resolveSemesterLabel(
  semesterId: string | undefined | null,
  labelMap: Record<string, string>,
  fallback = 'Semester pending'
) {
  if (!semesterId) return fallback
  return labelMap[semesterId] ?? semesterId
}

function isEnrolmentWindowOpen(
  semester: Pick<SemesterResponse, 'enrolmentOpenAt' | 'enrolmentCloseAt'>,
  now = new Date()
) {
  if (semester.enrolmentOpenAt && now < new Date(semester.enrolmentOpenAt)) return false
  if (semester.enrolmentCloseAt && now >= new Date(semester.enrolmentCloseAt)) return false
  return true
}

function internshipStatusChip(
  internshipStatus: InternshipStatus | string | null | undefined
): { label: string; tone: ChipTone } | null {
  if (!internshipStatus || internshipStatus === 'no_semester') return null

  if (internshipStatus === 'offer_approved') {
    return { label: 'Enrolled', tone: 'success' }
  }
  if (internshipStatus === 'offer_in_review') {
    return { label: 'Offer under review', tone: 'warning' }
  }
  if (internshipStatus === 'offer_changes_requested') {
    return { label: 'Changes requested', tone: 'warning' }
  }
  if (internshipStatus === 'browsing_opportunities') {
    return { label: 'Browse & apply', tone: 'active' }
  }
  if (internshipStatus === 'all_rejected') {
    return { label: 'No active applications', tone: 'muted' }
  }

  const label = INTERNSHIP_STATUS_LABELS[internshipStatus]
  return label ? { label, tone: 'neutral' } : null
}

export function deriveStudentSemesterChip(input: {
  semester: SemesterResponse | null
  semesterEnrolmentState?: SemesterEnrolmentState | null
  internshipStatus?: InternshipStatus | string | null
  now?: Date
}): { label: string; tone: ChipTone } {
  const { semester, semesterEnrolmentState, internshipStatus, now = new Date() } = input

  const progressChip = internshipStatusChip(internshipStatus)
  if (progressChip) return progressChip

  if (!semester) {
    return { label: 'No semester selected', tone: 'warning' }
  }

  if (semester.status === 'archived') {
    return { label: 'Semester archived', tone: 'muted' }
  }

  if (semester.status === 'placement_running') {
    return { label: 'Placements in progress', tone: 'active' }
  }

  if (semester.status === 'reporting') {
    return { label: 'Reporting period', tone: 'neutral' }
  }

  if (semesterEnrolmentState === 'window_closed' || !isEnrolmentWindowOpen(semester, now)) {
    return { label: 'Enrollment closed', tone: 'muted' }
  }

  if (semester.status === 'enrollment_open') {
    return { label: 'Enrollment open', tone: 'neutral' }
  }

  return { label: semesterStatusLabel(semester.status), tone: 'neutral' }
}

export function deriveStudentDashboardStatus(input: {
  semester: SemesterResponse | null
  workflow: UserWorkflowResponse | null
  currentWorkflowStep?: CurrentWorkflowStep | string | null
  appliedCount?: number
  pendingReviewCount?: number
}): {
  headline: string
  detail: string
  tone: ChipTone
  chipLabel: string
} {
  const { semester, workflow, appliedCount = 0, pendingReviewCount = 0 } = input
  const step = workflow?.currentWorkflowStep ?? input.currentWorkflowStep ?? 'profile'
  const internshipStatus = workflow?.internshipStatus
  const semesterLabel = semester ? formatSemesterLabel(semester) : 'your selected semester'
  const chip = deriveStudentSemesterChip({
    semester,
    semesterEnrolmentState: workflow?.semesterEnrolmentState,
    internshipStatus,
  })

  if (internshipStatus === 'offer_approved' && semester) {
    const course = semester.courseCode ? ` (${semester.courseCode})` : ''
    return {
      headline: 'Enrolled for this semester',
      detail: `Your placement is confirmed for ${semesterLabel}${course}. You are enrolled in the internship course for this teaching period and do not need to submit additional applications.`,
      tone: 'success',
      chipLabel: chip.label,
    }
  }

  if (internshipStatus === 'offer_in_review') {
    return {
      headline: 'Offer under review',
      detail: `Your offer documents for ${semesterLabel} are with your coordinator. You will be notified when a decision is made.`,
      tone: 'warning',
      chipLabel: chip.label,
    }
  }

  if (internshipStatus === 'offer_changes_requested') {
    return {
      headline: 'Action required on your offer',
      detail: `Update your submission for ${semesterLabel} — your coordinator requested changes.`,
      tone: 'warning',
      chipLabel: chip.label,
    }
  }

  if (internshipStatus === 'browsing_opportunities' && semester) {
    if (appliedCount > 0 || pendingReviewCount > 0) {
      return {
        headline: 'Applying for placements',
        detail: `You have ${appliedCount} application${appliedCount === 1 ? '' : 's'} and ${pendingReviewCount} offer${pendingReviewCount === 1 ? '' : 's'} in review for ${semesterLabel}.`,
        tone: 'active',
        chipLabel: chip.label,
      }
    }
    return {
      headline: 'Ready to apply',
      detail: `You are enrolled in ${semesterLabel}. Browse published opportunities and submit applications for this semester.`,
      tone: 'neutral',
      chipLabel: chip.label,
    }
  }

  if (step === 'semester_selection' || !semester) {
    return {
      headline: 'Select your semester',
      detail:
        'Choose the teaching period you are enrolling in for internship credit before browsing opportunities.',
      tone: 'warning',
      chipLabel: chip.label,
    }
  }

  if (step === 'profile') {
    return {
      headline: workflowStepLabel('profile'),
      detail: 'Finish your profile to unlock semester selection and applications.',
      tone: 'warning',
      chipLabel: chip.label,
    }
  }

  return {
    headline: workflowStepLabel(step),
    detail: workflowSummaryForStep(step, semesterLabel),
    tone: chip.tone,
    chipLabel: chip.label,
  }
}

function workflowSummaryForStep(step: string, semesterLabel: string) {
  if (step === 'offer_stage') {
    return `Your internship offer for ${semesterLabel} is being processed.`
  }
  if (step === 'completed') {
    return `Your placement for ${semesterLabel} is confirmed.`
  }
  return `Current progress for ${semesterLabel}.`
}

export function pickDefaultCoordinatorSemesterId(semesters: readonly SemesterResponse[]) {
  const priority: SemesterStatus[] = ['placement_running', 'enrollment_open', 'reporting']
  for (const status of priority) {
    const match = semesters.find((s) => s.status === status)
    if (match) return match.id
  }
  return semesters[0]?.id ?? null
}

export const CHIP_TONE_CLASSES: Record<ChipTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  muted: 'bg-slate-50 text-slate-500 border-slate-200',
  active: 'bg-blue-50 text-blue-800 border-blue-200',
}
