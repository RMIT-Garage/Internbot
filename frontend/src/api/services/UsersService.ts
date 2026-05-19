/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PatchUserRequest } from '../models/PatchUserRequest'
import type { PutSemesterSelectionRequest } from '../models/PutSemesterSelectionRequest'
import type { UserActivityFeedResponse } from '../models/UserActivityFeedResponse'
import type { UserResponse } from '../models/UserResponse'
import type { UserWorkflowResponse } from '../models/UserWorkflowResponse'
import type { CancelablePromise } from '../core/CancelablePromise'
import { OpenAPI } from '../core/OpenAPI'
import { request as __request } from '../core/request'
export class UsersService {
  /**
   * Return the caller's own platform user record
   * Resolves to the caller's platform user. The auth middleware hydrates identity from Firestore and JIT-creates the record on first call from a verified RMIT student email. Returns 403 `no_platform_user` when JIT cannot run (unverified email, non-student-shape email, or unprovisioned coordinator). See WORKFLOW-API-SPEC.md §7.2.
   * @returns UserResponse User found
   * @throws ApiError
   */
  public static getMyProfile(): CancelablePromise<UserResponse> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/users/me',
      errors: {
        401: `Missing or invalid Firebase ID token (or caller has not yet synced).`,
      },
    })
  }
  /**
   * Update the caller's own student profile
   * Resolves to the caller's platform user from the decoded token's `platformUserId` claim. Student-only. Top-level identity fields (`email`, `role`, `firebaseUid`, `status`, `onboardingStage`) are not writable. `profileStatus` is derived server-side. `studentProfile.studentNumber` is immutable after first sync. See WORKFLOW-API-SPEC.md §7.2.
   * @param requestBody
   * @param ifMatch Opt-in optimistic concurrency — the current ETag from a prior GET.
   * @returns UserResponse User updated
   * @throws ApiError
   */
  public static patchMyProfile(
    requestBody: PatchUserRequest,
    ifMatch?: string
  ): CancelablePromise<UserResponse> {
    return __request(OpenAPI, {
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: {
        'if-match': ifMatch,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `Body contains non-writable fields or violates \`studentNumber\` immutability.`,
        401: `Missing or invalid Firebase ID token (or caller has not yet synced).`,
        403: `Student caller is not the owner of the target user.`,
        405: `Coordinator caller — coordinators have no writable user fields in v1. Response includes \`Allow: GET\`.`,
        412: `Client sent \`If-Match\` and it does not match the current ETag.`,
        422: `Semantic validation failure (empty body, missing required fields, etc.).`,
      },
    })
  }
  /**
   * Return the caller's derived workflow state
   * Resolves to the caller's platform user. Student-only — coordinators have no workflow sub-resource and get 404. See WORKFLOW-API-SPEC.md §7.2.
   * @returns UserWorkflowResponse Derived workflow state for the target student.
   * @throws ApiError
   */
  public static getMyWorkflow(): CancelablePromise<UserWorkflowResponse> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/users/me/workflow',
      errors: {
        401: `Missing or invalid Firebase ID token (or caller has not yet synced).`,
        403: `Student caller is not the owner of the target user.`,
        404: `No user exists with the supplied id, OR the user is a coordinator (workflow sub-resource only exists for students).`,
      },
    })
  }
  /**
   * Return the caller's activity feed
   * Resolves to the caller's platform user and returns activity authored by that user across internship and opportunity workflows. See WORKFLOW-API-SPEC.md §7.2.
   * @param limit
   * @param pageToken
   * @param sort Default `-createdAt`. Prefix with `-` for descending.
   * @returns UserActivityFeedResponse Paginated activity feed authored by the caller.
   * @throws ApiError
   */
  public static getMyActivity(
    limit?: number,
    pageToken?: string,
    sort?: 'createdAt' | '-createdAt'
  ): CancelablePromise<UserActivityFeedResponse> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/users/me/activity',
      query: {
        limit: limit,
        pageToken: pageToken,
        sort: sort,
      },
      errors: {
        400: `Malformed query string or page token.`,
        401: `Missing or invalid Firebase ID token.`,
        403: `Caller is not the referenced user.`,
        404: `No user exists with the supplied id.`,
      },
    })
  }
  /**
   * Enrol the caller in a semester
   * Resolves to the caller's platform user. Student-only. The semester must be `active` and within its enrolment window. `semesterSelectedAt` is set on the first successful selection only. See WORKFLOW-API-SPEC.md §7.6.
   * @param requestBody
   * @param ifMatch Opt-in optimistic concurrency — the current ETag from a prior GET.
   * @returns UserResponse Selection accepted; returns the updated user resource.
   * @throws ApiError
   */
  public static putMySemesterSelection(
    requestBody: PutSemesterSelectionRequest,
    ifMatch?: string
  ): CancelablePromise<UserResponse> {
    return __request(OpenAPI, {
      method: 'PUT',
      url: '/api/v1/users/me/semester-selection',
      headers: {
        'if-match': ifMatch,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `Malformed body.`,
        401: `Missing or invalid Firebase ID token (or caller has not yet synced).`,
        403: `Student caller is not the owner of the target user.`,
        404: `No user exists with the supplied id, OR the user is a coordinator (semester-selection sub-resource only exists for students), OR the referenced semester does not exist.`,
        409: `Profile is not complete (\`profile_incomplete\`), referenced semester is not active (\`semester_not_active\`), or the enrolment window is closed (\`enrolment_window_closed\`).`,
        412: `Client sent \`If-Match\` and it does not match the current ETag.`,
        422: `\`semesterId\` missing or empty.`,
      },
    })
  }
  /**
   * Return a platform user by id
   * Polymorphic response shape by role. Students may read only their own record; coordinators may read any. Callers targeting themselves should prefer `GET /users/me`. See WORKFLOW-API-SPEC.md §7.2.
   * @param id Platform user id.
   * @returns UserResponse User found
   * @throws ApiError
   */
  public static getUser(id: string): CancelablePromise<UserResponse> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/users/{id}',
      path: {
        id: id,
      },
      errors: {
        401: `Missing or invalid Firebase ID token (or caller has not yet synced).`,
        403: `Student caller is not the owner of the requested user.`,
        404: `No user exists with the supplied id.`,
      },
    })
  }
  /**
   * Update a student's profile by id
   * Student-only. Students may only patch their own record; coordinators get `405 Allow: GET`. Callers targeting themselves should prefer `PATCH /users/me`. See WORKFLOW-API-SPEC.md §7.2.
   * @param id Platform user id.
   * @param requestBody
   * @param ifMatch Opt-in optimistic concurrency — the current ETag from a prior GET.
   * @returns UserResponse User updated
   * @throws ApiError
   */
  public static patchUser(
    id: string,
    requestBody: PatchUserRequest,
    ifMatch?: string
  ): CancelablePromise<UserResponse> {
    return __request(OpenAPI, {
      method: 'PATCH',
      url: '/api/v1/users/{id}',
      path: {
        id: id,
      },
      headers: {
        'if-match': ifMatch,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `Body contains non-writable fields or violates \`studentNumber\` immutability.`,
        401: `Missing or invalid Firebase ID token (or caller has not yet synced).`,
        403: `Student caller is not the owner of the target user.`,
        405: `Coordinator caller — coordinators have no writable user fields in v1. Response includes \`Allow: GET\`.`,
        412: `Client sent \`If-Match\` and it does not match the current ETag.`,
        422: `Semantic validation failure (empty body, missing required fields, etc.).`,
      },
    })
  }
  /**
   * Return the derived workflow state for a student
   * Student owner or coordinator. Coordinators may read any student's workflow during review. Coordinator targets get 404. See WORKFLOW-API-SPEC.md §7.2.
   * @param id Platform user id.
   * @returns UserWorkflowResponse Derived workflow state for the target student.
   * @throws ApiError
   */
  public static getUserWorkflow(id: string): CancelablePromise<UserWorkflowResponse> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/users/{id}/workflow',
      path: {
        id: id,
      },
      errors: {
        401: `Missing or invalid Firebase ID token (or caller has not yet synced).`,
        403: `Student caller is not the owner of the target user.`,
        404: `No user exists with the supplied id, OR the user is a coordinator (workflow sub-resource only exists for students).`,
      },
    })
  }
  /**
   * Return an activity feed by user id
   * Owner-only. The `{id}` path segment must match the authenticated platform user. Callers targeting themselves should prefer `GET /users/me/activity`. See WORKFLOW-API-SPEC.md §7.2.
   * @param id Platform user id.
   * @param limit
   * @param pageToken
   * @param sort Default `-createdAt`. Prefix with `-` for descending.
   * @returns UserActivityFeedResponse Paginated activity feed authored by the caller.
   * @throws ApiError
   */
  public static getUserActivity(
    id: string,
    limit?: number,
    pageToken?: string,
    sort?: 'createdAt' | '-createdAt'
  ): CancelablePromise<UserActivityFeedResponse> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/users/{id}/activity',
      path: {
        id: id,
      },
      query: {
        limit: limit,
        pageToken: pageToken,
        sort: sort,
      },
      errors: {
        400: `Malformed query string or page token.`,
        401: `Missing or invalid Firebase ID token.`,
        403: `Caller is not the referenced user.`,
        404: `No user exists with the supplied id.`,
      },
    })
  }
  /**
   * Enrol a student in a semester by id
   * Student-only and owner-only — students may only set their own semester. Coordinators get 404 (the sub-resource does not exist for `role: coordinator`). See WORKFLOW-API-SPEC.md §7.6.
   * @param id Platform user id.
   * @param requestBody
   * @param ifMatch Opt-in optimistic concurrency — the current ETag from a prior GET.
   * @returns UserResponse Selection accepted; returns the updated user resource.
   * @throws ApiError
   */
  public static putUserSemesterSelection(
    id: string,
    requestBody: PutSemesterSelectionRequest,
    ifMatch?: string
  ): CancelablePromise<UserResponse> {
    return __request(OpenAPI, {
      method: 'PUT',
      url: '/api/v1/users/{id}/semester-selection',
      path: {
        id: id,
      },
      headers: {
        'if-match': ifMatch,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `Malformed body.`,
        401: `Missing or invalid Firebase ID token (or caller has not yet synced).`,
        403: `Student caller is not the owner of the target user.`,
        404: `No user exists with the supplied id, OR the user is a coordinator (semester-selection sub-resource only exists for students), OR the referenced semester does not exist.`,
        409: `Profile is not complete (\`profile_incomplete\`), referenced semester is not active (\`semester_not_active\`), or the enrolment window is closed (\`enrolment_window_closed\`).`,
        412: `Client sent \`If-Match\` and it does not match the current ETag.`,
        422: `\`semesterId\` missing or empty.`,
      },
    })
  }
}
