/**
 * Component — `/api/v1/advisor/chat` route.
 *
 * The RAG upstream fetch is intercepted per-test via vi.spyOn so the emulator
 * handles real Firebase Auth while the external service is controlled.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { randomUUID } from 'node:crypto'
import { createApp } from '../../../src/api/app'
import { clearAuthUsers, clearDocs, initEmulator, mintEmulatorIdToken } from '../../setup.emulator'

const RAG_TEST_URL = 'http://rag-service.test'

function ragResponse(overrides: Record<string, unknown> = {}) {
  return {
    reply: 'You need 48 credit points to be eligible.',
    feature: 'faq-rag',
    contentType: 'plain',
    sources: [{ title: 'Internship Policy', section: 'Eligibility', sourceUrl: undefined }],
    webSources: [],
    ...overrides,
  }
}

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
    if (url.startsWith(RAG_TEST_URL)) {
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      })
    }
    return fetch(input, init)
  })
}

describe('/api/v1/advisor/chat — component', () => {
  let studentToken: string

  beforeAll(() => {
    initEmulator()
    process.env['RAG_SERVICE_URL'] = RAG_TEST_URL
  })

  beforeEach(async () => {
    const uid = `fb_${randomUUID()}`
    const email = `student_${randomUUID().slice(0, 6)}@student.rmit.edu.au`
    studentToken = await mintEmulatorIdToken(uid, email)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await clearDocs()
    await clearAuthUsers()
  })

  it('returns 200 with RAG response when upstream succeeds', async () => {
    const spy = mockFetch(200, ragResponse())

    const res = await request(createApp())
      .post('/api/v1/advisor/chat')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ userInput: 'What are the eligibility requirements?' })

    expect(res.status).toBe(200)
    expect(res.body.reply).toBe('You need 48 credit points to be eligible.')
    expect(res.body.sources).toHaveLength(1)
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('/api/chat/message'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('forwards feature as faq-rag and passes userInput', async () => {
    let capturedBody: Record<string, unknown> | undefined
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      if (url.startsWith(RAG_TEST_URL)) {
        capturedBody = JSON.parse((init?.body as string) ?? '{}') as Record<string, unknown>
        return new Response(JSON.stringify(ragResponse()), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return fetch(input, init)
    })

    await request(createApp())
      .post('/api/v1/advisor/chat')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ userInput: 'Tell me about credit points', useWebSearch: true })

    expect(capturedBody?.feature).toBe('faq-rag')
    expect(capturedBody?.userInput).toBe('Tell me about credit points')
    expect(capturedBody?.useWebSearch).toBe(true)
  })

  it('returns 422 when userInput is missing', async () => {
    const res = await request(createApp())
      .post('/api/v1/advisor/chat')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({})

    expect(res.status).toBe(422)
  })

  it('returns 422 when userInput is empty string', async () => {
    const res = await request(createApp())
      .post('/api/v1/advisor/chat')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ userInput: '' })

    expect(res.status).toBe(422)
  })

  it('returns 422 when userInput exceeds 2000 characters', async () => {
    const res = await request(createApp())
      .post('/api/v1/advisor/chat')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ userInput: 'x'.repeat(2001) })

    expect(res.status).toBe(422)
  })

  it('returns 401 when no auth token provided', async () => {
    const res = await request(createApp()).post('/api/v1/advisor/chat').send({ userInput: 'Hello' })

    expect(res.status).toBe(401)
  })

  it('preserves RAG sources when upstream returns FAQ structured data', async () => {
    mockFetch(200, {
      reply: '{"answer":"ignored"}',
      feature: 'faq-rag',
      structuredData: {
        type: 'faq',
        data: {
          answer: 'You need 48 credit points to be eligible.',
          sources: [],
          confidence: 0.9,
          answered_from_context: true,
        },
      },
      sources: [
        {
          title: 'Internship Policy',
          section: 'Eligibility',
          sourceUrl:
            'https://www.rmit.edu.au/students/careers-opportunities/internships-work-experience-wil',
          excerpt: 'Students must have completed 48 credit points.',
        },
      ],
      webSources: [],
    })

    const res = await request(createApp())
      .post('/api/v1/advisor/chat')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ userInput: 'What are the eligibility requirements?' })

    expect(res.status).toBe(200)
    expect(res.body.reply).toBe('You need 48 credit points to be eligible.')
    expect(res.body.sources).toHaveLength(1)
    expect(res.body.sources[0].excerpt).toContain('48 credit points')
    expect(res.body.structuredData).toBeUndefined()
  })

  it('returns 502 when upstream returns a non-2xx status', async () => {
    mockFetch(500, { error: 'Internal Server Error' })

    const res = await request(createApp())
      .post('/api/v1/advisor/chat')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ userInput: 'Test question' })

    expect(res.status).toBe(502)
  })

  it('returns 503 when RAG_SERVICE_URL is not configured', async () => {
    const original = process.env['RAG_SERVICE_URL']
    delete process.env['RAG_SERVICE_URL']

    try {
      const res = await request(createApp())
        .post('/api/v1/advisor/chat')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ userInput: 'Test question' })

      expect(res.status).toBe(503)
    } finally {
      process.env['RAG_SERVICE_URL'] = original
    }
  })
})
