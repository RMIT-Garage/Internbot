import type { Request, Response, NextFunction } from 'express'
import { ApiError } from '../errors'
import { DomainError } from '../../domain/errors'

/**
 * Global Express error handler — must be registered last in app.ts.
 *
 * Response shape per WORKFLOW-API-SPEC.md §7.0 (RFC 9457 Problem Details wrapped
 * under `error` with domain sub-codes):
 *
 *   {
 *     type, title, status, detail,
 *     error: { code, reason?, message, fields? }
 *   }
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

  if (apiError.allow) {
    res.setHeader('Allow', apiError.allow)
  }

  const errorBody: Record<string, unknown> = {
    code: apiError.code,
    message: apiError.detail,
  }
  if (apiError.reason !== undefined) errorBody['reason'] = apiError.reason
  if (apiError.fields !== undefined) errorBody['fields'] = apiError.fields

  res.status(apiError.status).json({
    type: apiError.type,
    title: apiError.title,
    status: apiError.status,
    detail: apiError.detail,
    error: errorBody,
  })
}
