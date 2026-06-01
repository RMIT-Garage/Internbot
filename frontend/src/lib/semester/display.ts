import type { SemesterResponse, SemesterStatus } from '@/types/api'
import type { SemesterEnrolmentState } from '@/api/models/SemesterEnrolmentState'
import type { InternshipStatus } from '@/api/models/InternshipStatus'

export const SEMESTER_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  enrollment_open: 'Enrollment Open',
  placement_running: 'Placements in Progress',
  reporting: 'Reporting',
  archived: 'Archived',
  active: 'Active',
}

type ChipTone = 'neutral' | 'warning' | 'success' | 'muted' | 'active'

export function formatSemesterLabel(semester: Pick<SemesterResponse, 'displayName' | 'courseCode'>) {
  return semester.courseCode
    ? `${semester.displayName} (${semester.courseCode})`
    : semester.displayName
}

export function formatSemesterShort(semester: Pick<SemesterResponse, 'displayName' | 'semesterCode' | 'courseCode'>) {
  const code = semester.semesterCode
  return code && semester.courseCode
    ? `${code} · ${semester.courseCode}`
    : semester.displayName
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

export function deriveStudentSemesterChip(input: {
  semester: SemesterResponse | null
  semesterEnrolmentState?: SemesterEnrolmentState | null
  internshipStatus?: InternshipStatus | string | null
  now?: Date
}): { label: string; tone: ChipTone } {
  const { semester, semesterEnrolmentState, internshipStatus, now = new Date() } = input

  if (internshipStatus === 'offer_approved') {
    return { label: 'Placement confirmed', tone: 'success' }
  }

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
