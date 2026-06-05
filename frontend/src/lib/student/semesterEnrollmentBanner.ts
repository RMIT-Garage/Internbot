import type { SemesterEnrolmentState } from '@/api/models/SemesterEnrolmentState'
import type { InternshipListItemResponse, SemesterResponse } from '@/lib/api/openapi-client'
import { formatSemesterLabel } from '@/lib/semester/display'

export type SemesterEnrollmentBannerTone = 'info' | 'warning' | 'success'

export interface SemesterEnrollmentBannerContent {
  show: boolean
  tone: SemesterEnrollmentBannerTone
  title: string
  body: string
  primaryAction?: { label: string; href: string }
}

const IN_FLIGHT_STATUSES = new Set(['applied', 'offer_pending_review', 'offer_changes_requested'])

export function internshipsForSemester(
  internships: readonly InternshipListItemResponse[],
  semesterId: string | null | undefined
) {
  if (!semesterId) return []
  return internships.filter((i) => i.semesterId === semesterId)
}

export function hasInFlightInternships(
  internships: readonly InternshipListItemResponse[],
  semesterId: string | null | undefined
) {
  return internshipsForSemester(internships, semesterId).some((i) =>
    IN_FLIGHT_STATUSES.has(i.status)
  )
}

export function hasApprovedPlacementInSemester(
  internships: readonly InternshipListItemResponse[],
  semesterId: string | null | undefined
) {
  return internshipsForSemester(internships, semesterId).some((i) => i.status === 'offer_approved')
}

export function findApprovedPlacement(internships: readonly InternshipListItemResponse[]) {
  return internships.find((i) => i.status === 'offer_approved') ?? null
}

export function hasAnyApprovedPlacement(internships: readonly InternshipListItemResponse[]) {
  return findApprovedPlacement(internships) != null
}

export function canApplyToNewOpportunities(input: {
  semester: SemesterResponse | null | undefined
  internships: readonly InternshipListItemResponse[]
  semesterId: string | null | undefined
}): boolean {
  const { semester, internships, semesterId } = input
  if (!semester || !semesterId) return false
  if (semester.status !== 'enrollment_open') return false
  if (hasAnyApprovedPlacement(internships)) return false
  return true
}

export type ApplyBlockReason =
  | 'ok'
  | 'not_published'
  | 'no_profile_semester'
  | 'semester_mismatch'
  | 'enrollment_closed'
  | 'placement_confirmed'

export function getApplyBlockReason(input: {
  opportunity: Pick<{ status: string; semesterId: string }, 'status' | 'semesterId'>
  profileSemesterId: string | null | undefined
  enrolledSemester: SemesterResponse | null | undefined
  internships: readonly InternshipListItemResponse[]
}): ApplyBlockReason {
  const { opportunity, profileSemesterId, enrolledSemester, internships } = input
  if (opportunity.status !== 'published') return 'not_published'
  if (!profileSemesterId) return 'no_profile_semester'
  if (opportunity.semesterId !== profileSemesterId) return 'semester_mismatch'
  if (hasAnyApprovedPlacement(internships)) return 'placement_confirmed'
  if (!enrolledSemester || enrolledSemester.status !== 'enrollment_open') {
    return 'enrollment_closed'
  }
  return 'ok'
}

export function canApplyToOpportunity(input: {
  opportunity: Pick<{ status: string; semesterId: string }, 'status' | 'semesterId'>
  profileSemesterId: string | null | undefined
  enrolledSemester: SemesterResponse | null | undefined
  internships: readonly InternshipListItemResponse[]
}): boolean {
  return getApplyBlockReason(input) === 'ok'
}

export function deriveSemesterEnrollmentBanner(input: {
  semester: SemesterResponse | null
  semesterEnrolmentState: SemesterEnrolmentState | string | null | undefined
  internships: readonly InternshipListItemResponse[]
  semesterId: string | null | undefined
  openSemesterCount?: number
}): SemesterEnrollmentBannerContent {
  const { semester, semesterEnrolmentState, internships, semesterId } = input
  const openSemesters = input.openSemesterCount ?? 0
  const label = semester ? formatSemesterLabel(semester) : 'your selected semester'

  if (!semesterId || !semester) {
    return hidden()
  }

  if (hasApprovedPlacementInSemester(internships, semesterId)) {
    return hidden()
  }

  if (semester.status === 'archived' || semesterEnrolmentState === 'not_enrolled') {
    const inFlight = hasInFlightInternships(internships, semesterId)
    if (inFlight) {
      return {
        show: true,
        tone: 'warning',
        title: 'This semester has ended',
        body: `${label} is archived. You cannot start new applications here. Continue your existing applications from My applications.`,
        primaryAction: { label: 'My applications', href: '/student/applications' },
      }
    }
    if (openSemesters > 0) {
      return {
        show: true,
        tone: 'warning',
        title: 'Choose an open semester',
        body: `${label} is no longer active. Select a semester that is open for enrollment to apply for internships.`,
        primaryAction: { label: 'Update semester', href: '/student/profile' },
      }
    }
    return {
      show: true,
      tone: 'warning',
      title: 'Semester no longer active',
      body: `${label} is not accepting new applications. Contact your coordinator if you need help.`,
    }
  }

  if (semesterEnrolmentState === 'window_closed' || semester.status !== 'enrollment_open') {
    const inFlight = hasInFlightInternships(internships, semesterId)
    if (inFlight) {
      return {
        show: true,
        tone: 'info',
        title: 'Enrollment closed for this semester',
        body: `New applications are closed for ${label}. You still have applications in progress — check My applications for updates and next steps.`,
        primaryAction: { label: 'My applications', href: '/student/applications' },
      }
    }
    if (openSemesters > 0) {
      return {
        show: true,
        tone: 'warning',
        title: 'This semester is closed for new applications',
        body: `${label} has moved to the placement phase. To apply in another teaching period, select a semester that is open for enrollment.`,
        primaryAction: { label: 'Select open semester', href: '/student/profile' },
      }
    }
    return {
      show: true,
      tone: 'warning',
      title: 'Enrollment closed',
      body: `New applications are closed for ${label}. No other semesters are open for enrollment right now — check back later or contact your coordinator.`,
    }
  }

  return hidden()
}

function hidden(): SemesterEnrollmentBannerContent {
  return { show: false, tone: 'info', title: '', body: '' }
}
