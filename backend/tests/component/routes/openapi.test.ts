import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../src/api/app'
import { initEmulator } from '../../setup.emulator'

/**
 * Component — /api/openapi.json + /api/docs
 *
 * The JSON doc and Swagger UI are public (no auth middleware). Verifies the
 * spec is well-formed OpenAPI 3.1, contains our known routes, uses the
 * current origin in `servers`, and ships components lifted from Zod `.meta()`
 * annotations.
 */

describe('GET /api/openapi.json — component', () => {
  beforeAll(() => initEmulator())

  it('returns OpenAPI 3.1 doc with Internbot info, paths, and bearerAuth scheme', async () => {
    const res = await request(createApp()).get('/api/openapi.json')

    expect(res.status).toBe(200)
    expect(res.body.openapi).toBe('3.1.0')
    expect(res.body.info.title).toBe('Internbot API')

    // Known v1 paths are present
    expect(res.body.paths['/api/v1/auth/sync']).toBeDefined()
    expect(res.body.paths['/api/v1/users/{id}']).toBeDefined()
    expect(res.body.paths['/api/health']).toBeDefined()

    // Auth scheme exposed
    expect(res.body.components.securitySchemes.bearerAuth).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    })

    // Schemas from .meta({ id }) lifted to components/schemas
    expect(res.body.components.schemas.UserResponse).toBeDefined()
    expect(res.body.components.schemas.AuthSyncRequest).toBeDefined()
    expect(res.body.components.schemas.ErrorResponse).toBeDefined()
  })

  it('servers block reflects the current origin (no hardcoded Cloud Functions URL)', async () => {
    const res = await request(createApp())
      .get('/api/openapi.json')
      .set('Host', 'api.example.com')
      .set('X-Forwarded-Proto', 'https')
      .set('X-Forwarded-Host', 'api.example.com')

    expect(res.status).toBe(200)
    expect(res.body.servers).toBeInstanceOf(Array)
    expect(res.body.servers[0].url).toBe('https://api.example.com')
  })
})

describe('GET /api/docs — Swagger UI', () => {
  beforeAll(() => initEmulator())

  it('serves Swagger UI HTML at /api/docs/', async () => {
    // swagger-ui-express mounts the static HTML at the trailing slash; Express
    // redirects /api/docs → /api/docs/ by default.
    const res = await request(createApp()).get('/api/docs/').redirects(1)
    expect(res.status).toBe(200)
    expect(res.text).toContain('swagger-ui')
    expect(res.headers['content-type']).toMatch(/html/)
  })
})
