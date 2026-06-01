import type { SemesterResponse } from '@/types/api'
import { isEnrolmentWindowOpen } from '@/lib/semester/display'

/** Statuses returned when loading the student semester picker (before enrollability filter). */
export const STUDENT_SEMESTER_LIST_STATUSES: Array<SemesterResponse['status']> = [
  'enrollment_open',
  'placement_running',
  'reporting',
]

/** Semesters a student may select for new enrollment (`PUT /users/me/semester-selection`). */
export function canStudentEnrollInSemester(
  semester: Pick<SemesterResponse, 'status' | 'enrolmentOpenAt' | 'enrolmentCloseAt'>
) {
  if (semester.status !== 'enrollment_open') return false
  return isEnrolmentWindowOpen(semester)
}

export function filterEnrollableSemesters(semesters: readonly SemesterResponse[]) {
  return semesters.filter(canStudentEnrollInSemester)
}
