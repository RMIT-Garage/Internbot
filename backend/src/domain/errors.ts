/**
 * Domain errors — pure TypeScript, no HTTP status codes.
 * Map to HTTP in api/errors.ts via ApiError.fromDomainError().
 *
 * All subclasses accept an optional `{ cause }` (ES2022 `Error.cause`) so
 * the original underlying error — typically a driver/library error caught
 * at the infrastructure boundary — can be preserved for diagnostics.
 * `util.inspect` and most structured loggers serialize `.cause` recursively.
 */

export interface FieldIssue {
  field: string
  code: string
  message: string
}

export interface DomainErrorOptions {
  cause?: unknown
}

export class DomainError extends Error {
  readonly code: string
  readonly reason: string | undefined
  readonly fields: FieldIssue[] | undefined

  constructor(
    message: string,
    code: string,
    reason?: string,
    fields?: FieldIssue[],
    options?: DomainErrorOptions
  ) {
    super(message, options)
    this.name = 'DomainError'
    this.code = code
    this.reason = reason
    this.fields = fields
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id?: string, options?: DomainErrorOptions) {
    super(
      id ? `${resource} '${id}' not found` : `${resource} not found`,
      'NOT_FOUND',
      undefined,
      undefined,
      options
    )
    this.name = 'NotFoundError'
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Forbidden', reason?: string, options?: DomainErrorOptions) {
    super(message, 'FORBIDDEN', reason, undefined, options)
    this.name = 'ForbiddenError'
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, reason?: string, options?: DomainErrorOptions) {
    super(message, 'CONFLICT', reason, undefined, options)
    this.name = 'ConflictError'
  }
}

export class ValidationError extends DomainError {
  constructor(
    message: string,
    reason?: string,
    fields?: FieldIssue[],
    options?: DomainErrorOptions
  ) {
    super(message, 'VALIDATION_ERROR', reason, fields, options)
    this.name = 'ValidationError'
  }
}

export class PreconditionFailedError extends DomainError {
  constructor(
    message = 'Precondition failed',
    reason: string = 'etag_mismatch',
    options?: DomainErrorOptions
  ) {
    super(message, 'PRECONDITION_FAILED', reason, undefined, options)
    this.name = 'PreconditionFailedError'
  }
}

export class MethodNotAllowedError extends DomainError {
  readonly allow: string

  constructor(
    allow: string,
    message = 'Method not allowed',
    reason?: string,
    options?: DomainErrorOptions
  ) {
    super(message, 'METHOD_NOT_ALLOWED', reason, undefined, options)
    this.name = 'MethodNotAllowedError'
    this.allow = allow
  }
}
