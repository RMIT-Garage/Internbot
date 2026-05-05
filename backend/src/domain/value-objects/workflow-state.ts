/**
 * Workflow state vocabulary.
 *
 * Two layered vocabularies, both derived (never persisted):
 *
 *   - **Coarse** `currentWorkflowStep` — routing vocabulary for the student's
 *     next workflow area.
 *
 *   - **Fine** `internshipStatus` — display-state vocabulary for the student's
 *     internship progress.
 *
 * `semesterEnrolmentState` is a third derived display state that reports
 * whether the student has enrolled in a semester and whether the enrolment
 * window is still open.
 *
 * All three are **derived** from the user aggregate, the student's internships,
 * and, for `semesterEnrolmentState`, the referenced semester aggregate.
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
