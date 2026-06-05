import { describe, expect, it } from 'vitest'
import { getOpenApiDocument } from '../../../src/api/openapi/generator'

describe('OpenAPI document', () => {
  it('includes v1 paths and bearer security', () => {
    const doc = getOpenApiDocument() as unknown as {
      openapi?: string
      paths?: Record<string, unknown>
      components?: { securitySchemes?: Record<string, { type?: string; scheme?: string }> }
    }

    expect(doc.openapi).toBe('3.1.0')
    expect(doc.paths?.['/v1/health']).toBeDefined()
    expect(doc.paths?.['/v1/chat/message']).toBeDefined()
    expect(doc.paths?.['/v1/chat/models']).toBeDefined()
    expect(doc.components?.securitySchemes?.bearerAuth?.type).toBe('http')
    expect(doc.components?.securitySchemes?.bearerAuth?.scheme).toBe('bearer')
  })
})
