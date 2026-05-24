/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AddInternshipCommentRequest } from '../models/AddInternshipCommentRequest'
import type { CreateInternshipAttachmentUploadIntentRequest } from '../models/CreateInternshipAttachmentUploadIntentRequest'
import type { CreateInternshipRequest } from '../models/CreateInternshipRequest'
import type { DecideInternshipOfferRequest } from '../models/DecideInternshipOfferRequest'
import type { InternshipActivityResponse } from '../models/InternshipActivityResponse'
import type { InternshipAttachmentDownloadResponse } from '../models/InternshipAttachmentDownloadResponse'
import type { InternshipAttachmentUploadIntentResponse } from '../models/InternshipAttachmentUploadIntentResponse'
import type { InternshipListResponse } from '../models/InternshipListResponse'
import type { InternshipResponse } from '../models/InternshipResponse'
import type { PatchInternshipRequest } from '../models/PatchInternshipRequest'
import type { SubmitInternshipOfferRequest } from '../models/SubmitInternshipOfferRequest'
import type { CancelablePromise } from '../core/CancelablePromise'
import { OpenAPI } from '../core/OpenAPI'
import { request as __request } from '../core/request'
export class InternshipsService {
  /**
   * List internships visible to the caller
   * Students are server-filtered to their own internships. Coordinators can list all internships and filter by status, opportunity, or user. See WORKFLOW-API-SPEC.md §7.4.
   * @param status
   * @param opportunityId
   * @param userId
   * @param limit
   * @param pageToken
   * @param sort Default `-createdAt`. Prefix with `-` for descending.
   * @returns InternshipListResponse Paginated list of internships.
   * @throws ApiError
   */
  public static listInternships(
    status?: Array<
      'applied' | 'offer_pending_review' | 'offer_changes_requested' | 'offer_approved' | 'rejected'
    >,
    opportunityId?: string,
    userId?: string,
    limit?: number,
    pageToken?: string,
    sort?: 'createdAt' | '-createdAt' | 'lastSubmittedAt' | '-lastSubmittedAt'
  ): CancelablePromise<InternshipListResponse> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/internships',
      query: {
        status: status,
        opportunityId: opportunityId,
        userId: userId,
        limit: limit,
        pageToken: pageToken,
        sort: sort,
      },
      errors: {
        400: `Malformed query string or student attempted to widen user filter.`,
        401: `Missing or invalid Firebase ID token.`,
      },
    })
  }
  /**
   * Apply to an opportunity
   * Student-only. Creates an internship application, apply activity, and coordinator notifications.
   * @param requestBody
   * @returns InternshipResponse Internship created.
   * @throws ApiError
   */
  public static createInternship(
    requestBody: CreateInternshipRequest
  ): CancelablePromise<InternshipResponse> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/v1/internships',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        403: `Caller is not a student.`,
        404: `Opportunity does not exist.`,
        409: `No selected semester, opportunity unpublished, semester mismatch, or duplicate application.`,
        422: `Missing required fields.`,
      },
    })
  }
  /**
   * Return an internship by id
   * Student owner or coordinator can read an internship.
   * @param id Platform internship id.
   * @returns InternshipResponse Internship found.
   * @throws ApiError
   */
  public static getInternship(id: string): CancelablePromise<InternshipResponse> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/internships/{id}',
      path: {
        id: id,
      },
      errors: {
        403: `Student cannot see this internship.`,
        404: `No internship exists with the supplied id.`,
      },
    })
  }
  /**
   * Update internship offer details
   * Student-owner only. Coordinators receive 405 and should use decisions or comments instead.
   * @param id Platform internship id.
   * @param requestBody
   * @param ifMatch Opt-in optimistic concurrency — the current ETag from a prior GET.
   * @returns InternshipResponse Internship updated.
   * @throws ApiError
   */
  public static patchInternship(
    id: string,
    requestBody: PatchInternshipRequest,
    ifMatch?: string
  ): CancelablePromise<InternshipResponse> {
    return __request(OpenAPI, {
      method: 'PATCH',
      url: '/api/v1/internships/{id}',
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
        403: `Student caller does not own the internship.`,
        405: `Coordinator callers cannot PATCH internships.`,
        409: `Internship is terminal and not editable.`,
        412: `Stale \`If-Match\`.`,
        422: `Empty body or domain validation failure.`,
      },
    })
  }
  /**
   * Reserve an internship attachment upload slot
   * Student-owner only. Allowed only while the internship is `applied` or `offer_changes_requested`. Pre-writes the attachment metadata as `uploading` and returns a short-lived V4 signed PUT URL the client uploads the file bytes to directly. The client MUST send a matching `Content-Type` header on the PUT. A GCS object-finalised event flips the attachment to `finalized`.
   * @param id Platform internship id.
   * @param requestBody
   * @returns InternshipAttachmentUploadIntentResponse Upload intent created. Use `uploadUrl` to PUT the file bytes.
   * @throws ApiError
   */
  public static createInternshipAttachmentUploadIntent(
    id: string,
    requestBody: CreateInternshipAttachmentUploadIntentRequest
  ): CancelablePromise<InternshipAttachmentUploadIntentResponse> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/v1/internships/{id}/attachments/upload-intents',
      path: {
        id: id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        403: `Caller is not the owning student.`,
        404: `No internship exists with the supplied id.`,
        409: `Internship status does not permit attachment upload.`,
        422: `Missing or invalid \`fileName\` / \`contentType\`.`,
      },
    })
  }
  /**
   * Return an internship attachment download resource
   * Returns attachment metadata with a fresh short-lived V4 signed Cloud Storage URL. Students can read only their own internship attachments; coordinators can read all.
   * @param id Platform internship id.
   * @param attachmentId Attachment id.
   * @returns InternshipAttachmentDownloadResponse Attachment found with a fresh signed download URL.
   * @throws ApiError
   */
  public static getInternshipAttachment(
    id: string,
    attachmentId: string
  ): CancelablePromise<InternshipAttachmentDownloadResponse> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/internships/{id}/attachments/{attachmentId}',
      path: {
        id: id,
        attachmentId: attachmentId,
      },
      errors: {
        403: `Student caller does not own the parent internship.`,
        404: `No internship or attachment exists with the supplied id.`,
      },
    })
  }
  /**
   * Delete an internship attachment
   * Owner-only (the student whose internship it is). Allowed only while the internship is `applied` or `offer_changes_requested`. Atomically removes the attachment metadata, then deletes the GCS object using `ifGenerationMatch` so a concurrent re-upload on the same path is preserved.
   * @param id Platform internship id.
   * @param attachmentId Attachment id.
   * @returns void
   * @throws ApiError
   */
  public static deleteInternshipAttachment(
    id: string,
    attachmentId: string
  ): CancelablePromise<void> {
    return __request(OpenAPI, {
      method: 'DELETE',
      url: '/api/v1/internships/{id}/attachments/{attachmentId}',
      path: {
        id: id,
        attachmentId: attachmentId,
      },
      errors: {
        403: `Caller is not the owning student.`,
        404: `No internship or attachment exists with the supplied id.`,
        409: `Internship status does not permit attachment deletion.`,
      },
    })
  }
  /**
   * Submit an internship offer for coordinator review
   * Student-owner only. Requires at least one finalized offer attachment and transitions applied/changes_requested to offer_pending_review. Offer dates are optional and may be supplied later by the coordinator.
   * @param id Platform internship id.
   * @param requestBody
   * @param ifMatch Opt-in optimistic concurrency — the current ETag from a prior GET.
   * @returns InternshipResponse Offer submitted.
   * @throws ApiError
   */
  public static submitInternshipOffer(
    id: string,
    requestBody: SubmitInternshipOfferRequest,
    ifMatch?: string
  ): CancelablePromise<InternshipResponse> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/v1/internships/{id}/offer-submissions',
      path: {
        id: id,
      },
      headers: {
        'if-match': ifMatch,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        403: `Caller is not the student owner.`,
        409: `Internship is not in an offer-submittable state.`,
        412: `Stale \`If-Match\`.`,
        422: `No finalized offer attachment present.`,
      },
    })
  }
  /**
   * Add a comment to an internship timeline
   * Student owner or coordinator can comment in any internship state. Comments do not rotate the parent ETag.
   * @param id Platform internship id.
   * @param requestBody
   * @returns InternshipActivityResponse Comment activity created.
   * @throws ApiError
   */
  public static addInternshipComment(
    id: string,
    requestBody: AddInternshipCommentRequest
  ): CancelablePromise<InternshipActivityResponse> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/v1/internships/{id}/comments',
      path: {
        id: id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        403: `Student caller does not own the internship.`,
        404: `No internship exists with the supplied id.`,
        422: `Missing or empty text.`,
      },
    })
  }
  /**
   * Submit a coordinator decision for an internship offer
   * Coordinator-only. Transitions offer_pending_review to approved, changes requested, or rejected and writes an activity plus student notification.
   * @param id Platform internship id.
   * @param requestBody
   * @param ifMatch Opt-in optimistic concurrency — the current ETag from a prior GET.
   * @returns InternshipResponse Decision recorded.
   * @throws ApiError
   */
  public static decideInternshipOffer(
    id: string,
    requestBody: DecideInternshipOfferRequest,
    ifMatch?: string
  ): CancelablePromise<InternshipResponse> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/v1/internships/{id}/decisions',
      path: {
        id: id,
      },
      headers: {
        'if-match': ifMatch,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        403: `Caller is not a coordinator.`,
        404: `No internship exists with the supplied id.`,
        409: `Internship is not pending offer review.`,
        412: `Stale \`If-Match\`.`,
        422: `Missing comment for changes_requested or rejected decisions.`,
      },
    })
  }
}
