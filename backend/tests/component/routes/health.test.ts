import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../src/api/app'
import { initEmulator } from '../../setup.emulator'

/**
 * Component-level smoke for the public /api/health endpoint and the
 * auth-boundary behaviour on protected paths. No DB state; no emulator
 * round-trip beyond Admin SDK init.
 */
describe('Health & auth boundary — component', () => {
  beforeAll(() => initEmulator())

  it('GET /api/health returns 200 with status ok', async () => {
    const res = await request(createApp()).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.timestamp).toBeDefined()
  })

  it('protected route without a token returns 401', async () => {
    const res = await request(createApp()).get('/api/v1/users/me')
    expect(res.status).toBe(401)
  })

  it('truly unknown public route returns 404', async () => {
    const res = await request(createApp()).get('/not-a-route')
    expect(res.status).toBe(404)
  })
})
