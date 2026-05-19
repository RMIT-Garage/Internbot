/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateTicketRequest } from '../models/CreateTicketRequest'
import type { PostTicketReplyRequest } from '../models/PostTicketReplyRequest'
import type { TicketListResponse } from '../models/TicketListResponse'
import type { TicketReplyResponse } from '../models/TicketReplyResponse'
import type { TicketResponse } from '../models/TicketResponse'
import type { TransitionTicketRequest } from '../models/TransitionTicketRequest'
import type { CancelablePromise } from '../core/CancelablePromise'
import { OpenAPI } from '../core/OpenAPI'
import { request as __request } from '../core/request'
export class TicketsService {
  /**
   * List tickets visible to the caller
   * Students are server-filtered to their own tickets; coordinators see all. See WORKFLOW-API-SPEC.md §7.10.
   * @param status
   * @param limit
   * @param pageToken
   * @param sort Default `-createdAt`. Prefix with `-` for descending.
   * @returns TicketListResponse Paginated list of tickets.
   * @throws ApiError
   */
  public static listTickets(
    status?: 'open' | 'in_progress' | 'resolved' | 'closed',
    limit?: number,
    pageToken?: string,
    sort?: 'createdAt' | '-createdAt'
  ): CancelablePromise<TicketListResponse> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/tickets',
      query: {
        status: status,
        limit: limit,
        pageToken: pageToken,
        sort: sort,
      },
      errors: {
        400: `Malformed query string or page token.`,
        401: `Missing or invalid Firebase ID token.`,
      },
    })
  }
  /**
   * Open a support ticket
   * Student-only. Creates a ticket in `open` state and notifies coordinators.
   * @param requestBody
   * @returns TicketResponse Ticket created.
   * @throws ApiError
   */
  public static createTicket(requestBody: CreateTicketRequest): CancelablePromise<TicketResponse> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/v1/tickets',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `Body contains immutable or unknown fields.`,
        403: `Caller is not a student.`,
        422: `Missing subject or body.`,
      },
    })
  }
  /**
   * Return a ticket by id
   * Ticket owner or coordinator.
   * @param id Platform ticket id.
   * @returns TicketResponse Ticket found.
   * @throws ApiError
   */
  public static getTicket(id: string): CancelablePromise<TicketResponse> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/tickets/{id}',
      path: {
        id: id,
      },
      errors: {
        403: `Student caller is not the ticket owner.`,
        404: `No ticket exists with the supplied id.`,
      },
    })
  }
  /**
   * Append a reply to a ticket
   * Ticket owner or coordinator. Bumps `updatedAt` but does not rotate the ticket ETag. Notifies the counterparty.
   * @param id Platform ticket id.
   * @param requestBody
   * @returns TicketReplyResponse Reply created.
   * @throws ApiError
   */
  public static postTicketReply(
    id: string,
    requestBody: PostTicketReplyRequest
  ): CancelablePromise<TicketReplyResponse> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/v1/tickets/{id}/replies',
      path: {
        id: id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        403: `Student caller is not the ticket owner.`,
        404: `No ticket exists with the supplied id.`,
        422: `Missing or empty text.`,
      },
    })
  }
  /**
   * Move a ticket through its support-workflow lifecycle
   * Allowed (from, to) pairs and per-pair role rules per WORKFLOW-API-SPEC.md §7.10. Activity recorded under `tickets/{id}/activity`.
   * @param id Platform ticket id.
   * @param requestBody
   * @param ifMatch Opt-in optimistic concurrency — the current ETag from a prior GET.
   * @returns TicketResponse Transition applied.
   * @throws ApiError
   */
  public static transitionTicket(
    id: string,
    requestBody: TransitionTicketRequest,
    ifMatch?: string
  ): CancelablePromise<TicketResponse> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/v1/tickets/{id}/transitions',
      path: {
        id: id,
      },
      headers: {
        'if-match': ifMatch,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `\`to\` is missing or not one of the allowed status values.`,
        403: `Caller does not own the ticket, or the role is not permitted to perform this transition.`,
        404: `No ticket exists with the supplied id.`,
        409: `Current status plus requested \`to\` is not a permitted transition.`,
        412: `Stale \`If-Match\`.`,
      },
    })
  }
}
