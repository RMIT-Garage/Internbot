/**
 * Domain errors — pure TypeScript, no HTTP status codes.
 * Map to HTTP in api/errors.ts via ApiError.fromDomainError().
 */

export interface FieldIssue {
  field: string
  code: string
  message: string
}

export class DomainError extends Error {
  readonly code: string
  readonly reason: string | undefined
  readonly fields: FieldIssue[] | undefined

  constructor(message: string, code: string, reason?: string, fields?: FieldIssue[]) {
    super(message)
    this.name = 'DomainError'
    this.code = code
    this.reason = reason
    this.fields = fields
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id?: string) {
    super(id ? `${resource} '${id}' not found` : `${resource} not found`, 'NOT_FOUND')
    this.name = 'NotFoundError'
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Forbidden', reason?: string) {
    super(message, 'FORBIDDEN', reason)
    this.name = 'ForbiddenError'
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, reason?: string) {
    super(message, 'CONFLICT', reason)
    this.name = 'ConflictError'
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, reason?: string, fields?: FieldIssue[]) {
    super(message, 'VALIDATION_ERROR', reason, fields)
    this.name = 'ValidationError'
  }
}

export class PreconditionFailedError extends DomainError {
  constructor(message = 'Precondition failed', reason: string = 'etag_mismatch') {
    super(message, 'PRECONDITION_FAILED', reason)
    this.name = 'PreconditionFailedError'
  }
}

export class MethodNotAllowedError extends DomainError {
  readonly allow: string

  constructor(allow: string, message = 'Method not allowed', reason?: string) {
    super(message, 'METHOD_NOT_ALLOWED', reason)
    this.name = 'MethodNotAllowedError'
    this.allow = allow
  }
}
