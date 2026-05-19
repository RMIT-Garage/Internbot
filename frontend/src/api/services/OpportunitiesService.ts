/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateOpportunityRequest } from '../models/CreateOpportunityRequest'
import type { OpportunityAttachmentDownloadResponse } from '../models/OpportunityAttachmentDownloadResponse'
import type { OpportunityListResponse } from '../models/OpportunityListResponse'
import type { OpportunityResponse } from '../models/OpportunityResponse'
import type { PatchOpportunityRequest } from '../models/PatchOpportunityRequest'
import type { TransitionOpportunityRequest } from '../models/TransitionOpportunityRequest'
import type { VerifyOpportunityRequest } from '../models/VerifyOpportunityRequest'
import type { CancelablePromise } from '../core/CancelablePromise'
import { OpenAPI } from '../core/OpenAPI'
import { request as __request } from '../core/request'
export class OpportunitiesService {
  /**
   * List opportunities visible to the caller
   * Students are server-filtered to published opportunities in their selected semester. Coordinators can filter by semester, status, and type. See WORKFLOW-API-SPEC.md §7.3.
   * @param semesterId
   * @param status
   * @param type
   * @param limit
   * @param pageToken
   * @param sort Default `-createdAt`. Prefix with `-` for descending.
   * @returns OpportunityListResponse Paginated list of opportunities.
   * @throws ApiError
   */
  public static listOpportunities(
    semesterId?: string,
    status?: Array<'draft' | 'pending_verification' | 'published' | 'rejected' | 'archived'>,
    type?: 'pre_approved' | 'custom',
    limit?: number,
    pageToken?: string,
    sort?: 'createdAt' | '-createdAt'
  ): CancelablePromise<OpportunityListResponse> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/opportunities',
      query: {
        semesterId: semesterId,
        status: status,
        type: type,
        limit: limit,
        pageToken: pageToken,
        sort: sort,
      },
      errors: {
        400: `Malformed query string or student attempted to widen semester filter.`,
        401: `Missing or invalid Firebase ID token.`,
        409: `Student caller has no selected semester.`,
      },
    })
  }
  /**
   * Create an opportunity
   * Coordinator-created opportunities start as draft. Student submissions become custom opportunities pending verification.
   * @param requestBody
   * @returns OpportunityResponse Opportunity created.
   * @throws ApiError
   */
  public static createOpportunity(
    requestBody: CreateOpportunityRequest
  ): CancelablePromise<OpportunityResponse> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/v1/opportunities',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `Malformed body or lifecycle fields supplied.`,
        409: `Student has no selected semester or semester is not active.`,
        422: `Missing required fields or Career Hub URL not on allowlist.`,
      },
    })
  }
  /**
   * Return an opportunity by id
   * Coordinators can read any opportunity. Students can read only published opportunities in their selected semester.
   * @param id Platform opportunity id.
   * @returns OpportunityResponse Opportunity found.
   * @throws ApiError
   */
  public static getOpportunity(id: string): CancelablePromise<OpportunityResponse> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/opportunities/{id}',
      path: {
        id: id,
      },
      errors: {
        403: `Student cannot see this opportunity.`,
        404: `No opportunity exists with the supplied id.`,
      },
    })
  }
  /**
   * Update opportunity metadata
   * Coordinator-only. Lifecycle fields are immutable through PATCH.
   * @param id Platform opportunity id.
   * @param requestBody
   * @param ifMatch Opt-in optimistic concurrency — the current ETag from a prior GET.
   * @returns OpportunityResponse Opportunity updated.
   * @throws ApiError
   */
  public static patchOpportunity(
    id: string,
    requestBody: PatchOpportunityRequest,
    ifMatch?: string
  ): CancelablePromise<OpportunityResponse> {
    return __request(OpenAPI, {
      method: 'PATCH',
      url: '/api/v1/opportunities/{id}',
      path: {
        id: id,
      },
      headers: {
        'if-match': ifMatch,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `Body contains immutable or unknown fields.`,
        403: `Caller is not a coordinator.`,
        404: `No opportunity exists with the supplied id.`,
        412: `Stale \`If-Match\`.`,
        422: `Empty body or domain validation failure.`,
      },
    })
  }
  /**
   * Return an opportunity attachment download resource
   * Returns attachment metadata with a fresh short-lived V4 signed Cloud Storage URL. Students can read only attachments on visible opportunities.
   * @param id Platform opportunity id.
   * @param attachmentId Attachment id.
   * @returns OpportunityAttachmentDownloadResponse Attachment found with a fresh signed download URL.
   * @throws ApiError
   */
  public static getOpportunityAttachment(
    id: string,
    attachmentId: string
  ): CancelablePromise<OpportunityAttachmentDownloadResponse> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/opportunities/{id}/attachments/{attachmentId}',
      path: {
        id: id,
        attachmentId: attachmentId,
      },
      errors: {
        403: `Student cannot see the parent opportunity.`,
        404: `No opportunity or attachment exists with the supplied id.`,
      },
    })
  }
  /**
   * Delete an opportunity attachment
   * Coordinator-only. Atomically removes the attachment metadata, then deletes the GCS object using `ifGenerationMatch` so a concurrent re-upload on the same path is preserved.
   * @param id Platform opportunity id.
   * @param attachmentId Attachment id.
   * @returns void
   * @throws ApiError
   */
  public static deleteOpportunityAttachment(
    id: string,
    attachmentId: string
  ): CancelablePromise<void> {
    return __request(OpenAPI, {
      method: 'DELETE',
      url: '/api/v1/opportunities/{id}/attachments/{attachmentId}',
      path: {
        id: id,
        attachmentId: attachmentId,
      },
      errors: {
        403: `Caller is not a coordinator.`,
        404: `No opportunity or attachment exists with the supplied id.`,
      },
    })
  }
  /**
   * Advance an opportunity's coordinator-controlled status
   * Coordinator-only. Allowed: draft → published, draft → archived, published → archived. Pending-verification opportunities use /verifications.
   * @param id Platform opportunity id.
   * @param requestBody
   * @param ifMatch Opt-in optimistic concurrency — the current ETag from a prior GET.
   * @returns OpportunityResponse Transition applied; activity record written.
   * @throws ApiError
   */
  public static transitionOpportunity(
    id: string,
    requestBody: TransitionOpportunityRequest,
    ifMatch?: string
  ): CancelablePromise<OpportunityResponse> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/v1/opportunities/{id}/transitions',
      path: {
        id: id,
      },
      headers: {
        'if-match': ifMatch,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        409: `Disallowed state transition.`,
        412: `Stale \`If-Match\`.`,
      },
    })
  }
  /**
   * Verify or reject a student-submitted opportunity
   * Coordinator-only. Applies only to pending_verification opportunities and creates a notification for the submitter.
   * @param id Platform opportunity id.
   * @param requestBody
   * @param ifMatch Opt-in optimistic concurrency — the current ETag from a prior GET.
   * @returns OpportunityResponse Verification applied.
   * @throws ApiError
   */
  public static verifyOpportunity(
    id: string,
    requestBody: VerifyOpportunityRequest,
    ifMatch?: string
  ): CancelablePromise<OpportunityResponse> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/v1/opportunities/{id}/verifications',
      path: {
        id: id,
      },
      headers: {
        'if-match': ifMatch,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        409: `Opportunity is not pending verification.`,
        412: `Stale \`If-Match\`.`,
        422: `Rejected verification missing comment.`,
      },
    })
  }
}
