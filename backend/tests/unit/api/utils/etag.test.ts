import { describe, it, expect } from 'vitest'
import { formatETag, parseIfMatch } from '../../../../src/api/utils/etag'

describe('formatETag', () => {
  it('renders a weak ETag for the given version', () => {
    expect(formatETag(0)).toBe('W/"0"')
    expect(formatETag(42)).toBe('W/"42"')
  })
})

describe('parseIfMatch', () => {
  it('returns undefined when the header is absent', () => {
    expect(parseIfMatch(undefined)).toBeUndefined()
  })

  it('returns undefined when the header is empty', () => {
    expect(parseIfMatch('')).toBeUndefined()
  })

  it('parses a weak ETag', () => {
    expect(parseIfMatch('W/"3"')).toBe(3)
  })

  it('parses a strong ETag', () => {
    expect(parseIfMatch('"7"')).toBe(7)
  })

  it('tolerates leading/trailing whitespace', () => {
    expect(parseIfMatch('  W/"12" ')).toBe(12)
  })

  it('throws ValidationError for malformed headers (no quotes)', () => {
    expect(() => parseIfMatch('42')).toThrowError(/If-Match/)
  })

  it('throws ValidationError for malformed headers (non-numeric body)', () => {
    expect(() => parseIfMatch('W/"abc"')).toThrowError(/If-Match/)
  })

  it('throws ValidationError carrying reason=invalid_if_match', () => {
    expect(() => parseIfMatch('garbage')).toThrowError(
      expect.objectContaining({ name: 'ValidationError', reason: 'invalid_if_match' })
    )
  })

  it('throws ValidationError for `*` (RFC 9110 wildcard not supported)', () => {
    // We don't currently support `If-Match: *` semantics; reject explicitly
    // rather than silently disabling OCC.
    expect(() => parseIfMatch('*')).toThrowError(/If-Match/)
  })
})
