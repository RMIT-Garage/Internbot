import type { DomainError, MethodNotAllowedError } from '../domain/errors'
import { type FieldIssue } from '../domain/errors'

/**
 * API-layer error — carries RFC 9457 Problem Details plus the domain-spec
 * `error.reason` sub-code and `error.fields` metadata (see WORKFLOW-API-SPEC.md §7.0).
 *
 * Rendered by errorHandler middleware as:
 *   {
 *     type, title, status, detail,
 *     error: { code, reason?, message, fields? }
 *   }
 */
export class ApiError extends Error {
  readonly status: number
  readonly type: string
  readonly title: string
  readonly detail: string
  readonly reason: string | undefined
  readonly fields: FieldIssue[] | undefined
  readonly allow: string | undefined

  constructor(
    status: number,
    title: string,
    detail: string,
    options: {
      type?: string
      reason?: string
      fields?: FieldIssue[]
      allow?: string
    } = {}
  ) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.title = title
    this.detail = detail
    this.type = options.type ?? `https://httpstatuses.io/${status}`
    this.reason = options.reason
    this.fields = options.fields
    this.allow = options.allow
  }

  /**
   * Coarse machine-readable code per WORKFLOW-API-SPEC.md §7.0.
   * Corresponds to the HTTP status class.
   */
  get code(): string {
    return coarseCodeForStatus(this.status)
  }

  static fromDomainError(err: DomainError): ApiError {
    const reason = err.reason
    const fields = err.fields
    switch (err.code) {
      case 'NOT_FOUND':
        return new ApiError(404, 'Not Found', err.message, { reason, fields })
      case 'FORBIDDEN':
        return new ApiError(403, 'Forbidden', err.message, { reason, fields })
      case 'CONFLICT':
        return new ApiError(409, 'Conflict', err.message, { reason, fields })
      case 'VALIDATION_ERROR':
        return new ApiError(422, 'Unprocessable Entity', err.message, { reason, fields })
      case 'PRECONDITION_FAILED':
        return new ApiError(412, 'Precondition Failed', err.message, { reason, fields })
      case 'METHOD_NOT_ALLOWED':
        return new ApiError(405, 'Method Not Allowed', err.message, {
          reason,
          fields,
          allow: (err as MethodNotAllowedError).allow,
        })
      default:
        return new ApiError(500, 'Internal Server Error', 'An unexpected error occurred')
    }
  }
}

export function coarseCodeForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'bad_request'
    case 401:
      return 'unauthorized'
    case 403:
      return 'forbidden'
    case 404:
      return 'not_found'
    case 405:
      return 'method_not_allowed'
    case 409:
      return 'conflict'
    case 412:
      return 'precondition_failed'
    case 422:
      return 'validation_failed'
    case 429:
      return 'rate_limited'
    case 503:
      return 'service_unavailable'
    default:
      return status >= 500 ? 'internal_error' : 'error'
  }
}
