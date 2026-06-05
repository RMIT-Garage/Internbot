import type { Request, Response, NextFunction } from 'express'
import { ApiError } from '../errors'
import { DomainError } from '../../domain/errors'

/**
 * Global Express error handler — must be registered last in app.ts.
 * Renders RFC 9457 Problem Details: { type, title, status, detail }
 *
 * Error routing:
 *   ApiError       → rendered as-is
 *   DomainError    → mapped to ApiError via ApiError.fromDomainError()
 *   Unknown errors → 500 Internal Server Error (message hidden in production)
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  let apiError: ApiError

  if (err instanceof ApiError) {
    apiError = err
  } else if (err instanceof DomainError) {
    apiError = ApiError.fromDomainError(err)
  } else {
    console.error('[Unhandled error]', err)
    apiError = new ApiError(500, 'Internal Server Error', 'An unexpected error occurred')
  }

  if (apiError.status >= 500) {
    console.error(`[${apiError.status}] ${err.message}`, err.stack)
  }

  res.status(apiError.status).json({
    type: apiError.type,
    title: apiError.title,
    status: apiError.status,
    detail: apiError.detail,
  })
}
