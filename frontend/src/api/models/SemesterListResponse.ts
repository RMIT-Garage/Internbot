/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SemesterResponse } from './SemesterResponse'
/**
 * Paginated list of semesters.
 */
export type SemesterListResponse = {
  items: Array<SemesterResponse>
  nextPageToken: string | null
}
