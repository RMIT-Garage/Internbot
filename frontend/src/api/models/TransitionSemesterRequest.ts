/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Body for POST /api/v1/semesters/:id/transitions. See WORKFLOW-API-SPEC.md §7.5.
 */
export type TransitionSemesterRequest = {
  to: TransitionSemesterRequest.to
  comment?: string
}
export namespace TransitionSemesterRequest {
  export enum to {
    ACTIVE = 'active',
    ARCHIVED = 'archived',
  }
}
