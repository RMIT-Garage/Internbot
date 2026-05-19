/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Body for PATCH /api/v1/semesters/:id. Immutable fields (`id`, `semesterCode`, `courseCode`, `status`) are rejected with 400. Use POST /api/v1/semesters/:id/transitions for status changes. See WORKFLOW-API-SPEC.md §7.5.
 */
export type PatchSemesterRequest = {
  displayName?: string
  enrolmentOpenAt?: string | null
  enrolmentCloseAt?: string | null
}
