/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Body for POST /api/v1/semesters. Coordinator-only. See WORKFLOW-API-SPEC.md §7.5.
 */
export type CreateSemesterRequest = {
  semesterCode: string
  courseCode: string
  displayName: string
  status: CreateSemesterRequest.status
  enrolmentOpenAt?: string
  enrolmentCloseAt?: string
}
export namespace CreateSemesterRequest {
  export enum status {
    DRAFT = 'draft',
    ENROLLMENT_OPEN = 'enrollment_open',
    PLACEMENT_RUNNING = 'placement_running',
    REPORTING = 'reporting',
    ARCHIVED = 'archived',
  }
}
