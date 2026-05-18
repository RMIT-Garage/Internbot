import type { Semester } from '../entities/semester'
import type { Internship } from '../entities/internship'
import type { User } from '../entities/user'
import type {
  CurrentWorkflowStep,
  InternshipStatus,
  SemesterEnrolmentState,
} from '../value-objects/workflow-state'

/**
 * Derive workflow state from a student User aggregate, their selected
 * semester, and their internship applications.
 *
 * `semester` is optional because `studentProfile.semesterId` may point at
 * a semester that is unavailable. Passing `undefined` reports
 * `not_enrolled` even when a `semesterId` is set, while still deriving the
 * coarse step from the student's selected semester id.
 */
export interface WorkflowState {
  currentWorkflowStep: CurrentWorkflowStep
  internshipStatus: InternshipStatus
  semesterEnrolmentState: SemesterEnrolmentState
}

export function deriveWorkflowState(
  user: User,
  semester: Semester | undefined,
  now: Date,
  internships: readonly Internship[] = []
): WorkflowState {
  if (!user.isStudent()) {
    throw new Error('deriveWorkflowState may only be called on a student user')
  }

  const profile = user.studentProfile

  if (profile.profileStatus !== 'complete') {
    return {
      currentWorkflowStep: 'profile',
      // The fine workflow vocabulary only starts once the profile is complete.
      // Use the pre-enrolment value while the student is still in profile setup.
      internshipStatus: 'no_semester',
      semesterEnrolmentState: 'not_enrolled',
    }
  }

  if (!profile.semesterId) {
    return {
      currentWorkflowStep: 'semester_selection',
      internshipStatus: 'no_semester',
      semesterEnrolmentState: 'not_enrolled',
    }
  }

  return {
    ...deriveInternshipProgress(internships),
    semesterEnrolmentState: deriveSemesterEnrolmentState(semester, now),
  }
}

function deriveSemesterEnrolmentState(
  semester: Semester | undefined,
  now: Date
): SemesterEnrolmentState {
  if (!semester) return 'not_enrolled'
  return semester.isEnrolmentOpen(now) ? 'enrolled' : 'window_closed'
}

function deriveInternshipProgress(
  internships: readonly Internship[]
): Pick<WorkflowState, 'currentWorkflowStep' | 'internshipStatus'> {
  const statuses = internships.map((internship) => internship.status)

  if (statuses.includes('offer_approved')) {
    return { currentWorkflowStep: 'completed', internshipStatus: 'offer_approved' }
  }
  if (statuses.includes('offer_changes_requested')) {
    return { currentWorkflowStep: 'offer_stage', internshipStatus: 'offer_changes_requested' }
  }
  if (statuses.includes('offer_pending_review')) {
    return { currentWorkflowStep: 'offer_stage', internshipStatus: 'offer_in_review' }
  }
  if (statuses.length > 0 && statuses.every((status) => status === 'rejected')) {
    return { currentWorkflowStep: 'opportunity_browsing', internshipStatus: 'all_rejected' }
  }
  return { currentWorkflowStep: 'opportunity_browsing', internshipStatus: 'browsing_opportunities' }
}
