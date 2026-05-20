/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ErrorField } from './ErrorField'
export type ErrorBody = {
  /**
   * Coarse machine-readable code aligned to HTTP status class.
   */
  code: ErrorBody.code
  /**
   * Fine-grained sub-code for client UX branching (see WORKFLOW-API-SPEC.md §7.0).
   */
  reason?: string
  message: string
  fields?: Array<ErrorField>
}
export namespace ErrorBody {
  /**
   * Coarse machine-readable code aligned to HTTP status class.
   */
  export enum code {
    BAD_REQUEST = 'bad_request',
    UNAUTHORIZED = 'unauthorized',
    FORBIDDEN = 'forbidden',
    NOT_FOUND = 'not_found',
    METHOD_NOT_ALLOWED = 'method_not_allowed',
    CONFLICT = 'conflict',
    PRECONDITION_FAILED = 'precondition_failed',
    VALIDATION_FAILED = 'validation_failed',
    RATE_LIMITED = 'rate_limited',
    SERVICE_UNAVAILABLE = 'service_unavailable',
    INTERNAL_ERROR = 'internal_error',
  }
}
