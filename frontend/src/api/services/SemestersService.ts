/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateSemesterRequest } from '../models/CreateSemesterRequest'
import type { PatchSemesterRequest } from '../models/PatchSemesterRequest'
import type { SemesterListResponse } from '../models/SemesterListResponse'
import type { SemesterResponse } from '../models/SemesterResponse'
import type { TransitionSemesterRequest } from '../models/TransitionSemesterRequest'
import type { CancelablePromise } from '../core/CancelablePromise'
import { OpenAPI } from '../core/OpenAPI'
import { request as __request } from '../core/request'
export class SemestersService {
  /**
   * List semesters with optional filters and pagination
   * Returns semesters configured in the app. Any authenticated platform user may list. See WORKFLOW-API-SPEC.md §7.5.
   * @param status Filter by status. Repeat the param for multi-value (`?status=draft&status=active`).
   * @param semesterCode
   * @param courseCode
   * @param limit
   * @param pageToken
   * @param sort Default `-createdAt`. Prefix with `-` for descending.
   * @returns SemesterListResponse Paginated list of semesters.
   * @throws ApiError
   */
  public static listSemesters(
    status?: Array<'draft' | 'active' | 'archived'>,
    semesterCode?: string,
    courseCode?: string,
    limit?: number,
    pageToken?: string,
    sort?: 'createdAt' | '-createdAt' | 'enrolmentOpenAt' | '-enrolmentOpenAt'
  ): CancelablePromise<SemesterListResponse> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/semesters',
      query: {
        status: status,
        semesterCode: semesterCode,
        courseCode: courseCode,
        limit: limit,
        pageToken: pageToken,
        sort: sort,
      },
      errors: {
        400: `Malformed query string (unknown sort field, invalid filter, etc.).`,
        401: `Missing or invalid Firebase ID token.`,
        403: `Caller has no platform user record.`,
      },
    })
  }
  /**
   * Create a semester
   * Coordinator-only. Natural-key uniqueness on `(semesterCode, courseCode)` is enforced atomically — concurrent calls produce exactly one document. See WORKFLOW-API-SPEC.md §7.5.
   * @param requestBody
   * @returns SemesterResponse Semester created.
   * @throws ApiError
   */
  public static createSemester(
    requestBody: CreateSemesterRequest
  ): CancelablePromise<SemesterResponse> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/v1/semesters',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `Malformed body (unknown enum, bad ISO timestamp, etc.).`,
        401: `Missing or invalid Firebase ID token.`,
        403: `Caller is not a coordinator.`,
        409: `Duplicate \`(semesterCode, courseCode)\` tuple.`,
        422: `Body parsed but missing required fields.`,
      },
    })
  }
  /**
   * Return a semester by id
   * Any authenticated platform user may read. Response carries an `ETag` clients can echo as `If-Match` on subsequent PATCH / transition calls. See WORKFLOW-API-SPEC.md §7.5.
   * @param id Platform semester id.
   * @returns SemesterResponse Semester found.
   * @throws ApiError
   */
  public static getSemester(id: string): CancelablePromise<SemesterResponse> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/semesters/{id}',
      path: {
        id: id,
      },
      errors: {
        401: `Missing or invalid Firebase ID token.`,
        403: `Caller has no platform user record.`,
        404: `No semester exists with the supplied id.`,
      },
    })
  }
  /**
   * Update a semester (label and enrolment window only)
   * Coordinator-only. `id`, `semesterCode`, `courseCode`, `status` are immutable through this endpoint — use `POST /semesters/:id/transitions` for status changes. See WORKFLOW-API-SPEC.md §7.5.
   * @param id Platform semester id.
   * @param requestBody
   * @param ifMatch Opt-in optimistic concurrency — the current ETag from a prior GET.
   * @returns SemesterResponse Semester updated.
   * @throws ApiError
   */
  public static patchSemester(
    id: string,
    requestBody: PatchSemesterRequest,
    ifMatch?: string
  ): CancelablePromise<SemesterResponse> {
    return __request(OpenAPI, {
      method: 'PATCH',
      url: '/api/v1/semesters/{id}',
      path: {
        id: id,
      },
      headers: {
        'if-match': ifMatch,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `Body contains immutable / unknown fields.`,
        401: `Unauthorized.`,
        403: `Caller is not a coordinator.`,
        404: `No semester exists with the supplied id.`,
        412: `Stale \`If-Match\`.`,
        422: `Empty body.`,
      },
    })
  }
  /**
   * Advance a semester's lifecycle status
   * Coordinator-only. Allowed: `draft → active`, `draft → archived`, `active → archived`. Anything else returns 409 `invalid_state_transition`. Writes an activity record alongside the status update. See WORKFLOW-API-SPEC.md §7.5.
   * @param id Platform semester id.
   * @param requestBody
   * @param ifMatch Opt-in optimistic concurrency — the current ETag from a prior GET.
   * @returns SemesterResponse Transition applied; activity record written.
   * @throws ApiError
   */
  public static transitionSemester(
    id: string,
    requestBody: TransitionSemesterRequest,
    ifMatch?: string
  ): CancelablePromise<SemesterResponse> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/v1/semesters/{id}/transitions',
      path: {
        id: id,
      },
      headers: {
        'if-match': ifMatch,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `Malformed body (\`to\` missing or invalid).`,
        401: `Unauthorized.`,
        403: `Caller is not a coordinator.`,
        404: `No semester exists with the supplied id.`,
        409: `Disallowed state transition.`,
        412: `Stale \`If-Match\`.`,
      },
    })
  }
}
