/**
 * Workflow state vocabulary.
 *
 * Two layered vocabularies, both derived (never persisted):
 *
 *   - **Coarse** `currentWorkflowStep` — frontend routing vocabulary, defined
 *     in WORKFLOW-API-SPEC.md §7.1. Returned by `GET /users/{id}` and
 *     `GET /users/{id}/workflow`.
 *
 *   - **Fine** `internshipStatus` — display-state vocabulary, defined in
 *     WORKFLOW-API-SPEC.md §9.2. Returned by `GET /users/{id}/workflow`.
 *
 * `semesterEnrolmentState` is a third derived display state (also returned
 * by `GET /users/{id}/workflow`) that reports whether the student has
 * enrolled in a semester and whether the enrolment window is still open.
 *
 * All three are **derived** at response time from the user aggregate (and,
 * for `semesterEnrolmentState`, the referenced semester aggregate). Nothing
 * here is stored on Firestore — the source of truth is `studentProfile`
 * + `internships` + `semesters`.
 */

export const currentWorkflowStepValues = [
  'profile',
  'semester_selection',
  'opportunity_browsing',
  'offer_stage',
  'completed',
] as const
export type CurrentWorkflowStep = (typeof currentWorkflowStepValues)[number]

export const internshipStatusValues = [
  'no_semester',
  'browsing_opportunities',
  'offer_in_review',
  'offer_changes_requested',
  'offer_approved',
  'all_rejected',
] as const
export type InternshipStatus = (typeof internshipStatusValues)[number]

export const semesterEnrolmentStateValues = ['not_enrolled', 'enrolled', 'window_closed'] as const
export type SemesterEnrolmentState = (typeof semesterEnrolmentStateValues)[number]
