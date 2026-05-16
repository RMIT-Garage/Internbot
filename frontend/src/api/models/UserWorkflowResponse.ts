/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CurrentWorkflowStep } from './CurrentWorkflowStep'
import type { InternshipStatus } from './InternshipStatus'
import type { SemesterEnrolmentState } from './SemesterEnrolmentState'
/**
 * Body of GET /api/v1/users/{id}/workflow. All three fields are derived (none are persisted).
 */
export type UserWorkflowResponse = {
  currentWorkflowStep: CurrentWorkflowStep
  internshipStatus: InternshipStatus
  semesterEnrolmentState: SemesterEnrolmentState
}
