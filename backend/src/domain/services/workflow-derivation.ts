import type { Semester } from '../entities/semester'
import type { User } from '../entities/user'
import type {
  CurrentWorkflowStep,
  InternshipStatus,
  SemesterEnrolmentState,
} from '../value-objects/workflow-state'

/**
 * Derive workflow state from a student User aggregate (and optionally the
 * semester they have selected).
 *
 * **Phase 3 scope.** Internship records do not exist yet (Phase 5), so the
 * fine `internshipStatus` collapses to `no_semester` /
 * `browsing_opportunities` and the coarse `currentWorkflowStep` collapses
 * to `profile` / `semester_selection` / `opportunity_browsing`. Once
 * Phase 5+ lands, this function gains an `internships` parameter and
 * implements the full §7.1 / §9.2 tables. The derivation lives in one
 * place so later phases extend a single function rather than duplicating
 * branching across mappers and handlers.
 *
 * `semester` is optional because `studentProfile.semesterId` may point at
 * a semester the caller didn't (or couldn't) load. Pass `undefined` and
 * the result reports `not_enrolled` even when a `semesterId` is set —
 * defensive degradation for read paths that don't need the window check.
 */
export interface WorkflowState {
  currentWorkflowStep: CurrentWorkflowStep
  internshipStatus: InternshipStatus
  semesterEnrolmentState: SemesterEnrolmentState
}

export function deriveWorkflowState(
  user: User,
  semester: Semester | undefined,
  now: Date
): WorkflowState {
  if (!user.isStudent()) {
    throw new Error('deriveWorkflowState may only be called on a student user')
  }

  const profile = user.studentProfile

  if (profile.profileStatus !== 'complete') {
    return {
      currentWorkflowStep: 'profile',
      // §9.2 starts at `no_semester` once profile is complete; while still
      // incomplete the fine status is undefined per the spec table — we
      // return `no_semester` as the safe pre-enrolment value because the
      // wire schema requires a non-null string.
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
    currentWorkflowStep: 'opportunity_browsing',
    internshipStatus: 'browsing_opportunities',
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
