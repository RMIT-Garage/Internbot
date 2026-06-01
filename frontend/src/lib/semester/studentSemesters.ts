import type { SemesterResponse } from '@/types/api'
import { isEnrolmentWindowOpen } from '@/lib/semester/display'

/** Statuses returned when loading the student semester picker (before status filter). */
export const STUDENT_SEMESTER_LIST_STATUSES: Array<SemesterResponse['status']> = [
  'enrollment_open',
  'placement_running',
  'reporting',
]

/** Semesters a student may set on their profile (`PUT /users/me/semester-selection`). */
export function canStudentSelectSemester(semester: Pick<SemesterResponse, 'status'>): boolean {
  return semester.status === 'enrollment_open'
}

/**
 * Semesters where the student may apply for new opportunities today
 * (status open + enrolment dates include now).
 */
export function canStudentEnrollInSemester(
  semester: Pick<SemesterResponse, 'status' | 'enrolmentOpenAt' | 'enrolmentCloseAt'>
): boolean {
  if (semester.status !== 'enrollment_open') return false
  return isEnrolmentWindowOpen(semester)
}

export function filterSelectableSemesters(semesters: readonly SemesterResponse[]) {
  return semesters.filter(canStudentSelectSemester)
}

/** @deprecated Prefer `filterSelectableSemesters` for profile/picker; kept for apply-only filters. */
export function filterEnrollableSemesters(semesters: readonly SemesterResponse[]) {
  return semesters.filter(canStudentEnrollInSemester)
}
