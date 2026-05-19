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
}
export namespace SemesterResponse {
  export enum status {
    DRAFT = 'draft',
    ACTIVE = 'active',
    ARCHIVED = 'archived',
  }
}
