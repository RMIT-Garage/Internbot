/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Semester record (see WORKFLOW-API-SPEC.md §7.5 / §8.5).
 */
export type SemesterResponse = {
  id: string
  semesterCode: string
  courseCode: string
  displayName: string
  status: SemesterResponse.status
  enrolmentOpenAt: string | null
  enrolmentCloseAt: string | null
  createdAt: string
  updatedAt: string
  enrolledStudentCount: number
  openOfferCount: number
}
export namespace SemesterResponse {
  export enum status {
    DRAFT = 'draft',
    ENROLLMENT_OPEN = 'enrollment_open',
    PLACEMENT_RUNNING = 'placement_running',
    REPORTING = 'reporting',
    ARCHIVED = 'archived',
  }
}
