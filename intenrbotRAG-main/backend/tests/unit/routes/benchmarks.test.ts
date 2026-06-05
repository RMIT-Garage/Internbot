import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../src/api/app'
import { mockActor, mockTokenVerifier } from '../../setup'

const app = createApp({ tokenVerifier: mockTokenVerifier })

describe('POST /api/benchmarks/single-case', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(mockTokenVerifier.verify).mockResolvedValue(mockActor)
  })

  it('returns 401 without bearer token', async () => {
    const res = await request(app).post('/api/benchmarks/single-case').send({
      feature: 'contract-checker',
      mode: 'smoke',
      caseId: 'CC-SMOKE-001',
      fixtures: true,
    })

    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid request body', async () => {
    const res = await request(app)
      .post('/api/benchmarks/single-case')
      .set('Authorization', 'Bearer token')
      .send({
        feature: 'contract-checker',
        mode: 'smoke',
        caseId: '',
        fixtures: true,
      })

    expect(res.status).toBe(400)
    expect(res.body.detail).toContain('caseId')
  })

  it('returns 200 for valid fixture single-case run', async () => {
    const res = await request(app)
      .post('/api/benchmarks/single-case')
      .set('Authorization', 'Bearer token')
      .send({
        feature: 'contract-checker',
        mode: 'smoke',
        caseId: 'CC-SMOKE-001',
        fixtures: true,
      })

    expect(res.status).toBe(200)
    expect(res.body.feature).toBe('contract-checker')
    expect(res.body.execution.caseId).toBe('CC-SMOKE-001')
    expect(typeof res.body.execution.parseSuccess).toBe('boolean')
  })

  it('returns 400 when case ID is unknown', async () => {
    const res = await request(app)
      .post('/api/benchmarks/single-case')
      .set('Authorization', 'Bearer token')
      .send({
        feature: 'contract-checker',
        mode: 'smoke',
        caseId: 'CC-SMOKE-DOES-NOT-EXIST',
        fixtures: true,
      })

    expect(res.status).toBe(400)
    expect(res.body.detail).toContain('Case id')
  })
})
