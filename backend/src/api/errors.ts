import type { DomainError } from '../domain/errors'

/**
 * API-layer error — carries RFC 9457 Problem Details fields.
 * Rendered by errorHandler middleware as:
 *   { type, title, status, detail }
 */
export class ApiError extends Error {
  readonly status: number
  readonly type: string
  readonly title: string
  readonly detail: string

  constructor(status: number, title: string, detail: string, type?: string) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.title = title
    this.detail = detail
    this.type = type ?? `https://httpstatuses.io/${status}`
  }

  static fromDomainError(err: DomainError): ApiError {
    switch (err.code) {
      case 'NOT_FOUND':
        return new ApiError(404, 'Not Found', err.message)
      case 'FORBIDDEN':
        return new ApiError(403, 'Forbidden', err.message)
      case 'CONFLICT':
        return new ApiError(409, 'Conflict', err.message)
      case 'VALIDATION_ERROR':
        return new ApiError(400, 'Bad Request', err.message)
      default:
        return new ApiError(500, 'Internal Server Error', 'An unexpected error occurred')
    }
  }
}
