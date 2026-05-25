/**
 * Component — `/api/v1/coordinator/ai` routes.
 *
 * RAG upstream fetch is intercepted per-test via vi.spyOn so the emulator
 * handles real Firebase Auth while the external service is controlled.
 * Coordinator role is enforced via the platform user record in Firestore.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { randomUUID } from 'node:crypto'
import { createApp } from '../../../src/api/app'
import { FirestoreUnitOfWork } from '../../../src/infrastructure/firestore/firestore-unit-of-work'
import { User } from '../../../src/domain/entities/user'
import { UserIdentity } from '../../../src/domain/value-objects/user-identity'
import {
  clearAuthUsers,
  clearDocs,
  initEmulator,
  mintEmulatorIdToken,
  trackDoc,
} from '../../setup.emulator'

const RAG_TEST_URL = 'http://rag-service.test'

function checkerResponse(overrides: Record<string, unknown> = {}) {
  return {
    reply:
      '{"decision":"Yes","confidence":0.9,"concerns":[],"reasonCodes":[],"summary":"Eligible.","scratchpad":"RULE_1_TECHNICAL_ALIGNMENT: PASS | Evidence: computing role | Reason: meets criteria"}',
    feature: 'job-checker',
    contentType: 'structured',
    structuredData: {
      type: 'checker',
      data: {
        decision: 'Yes',
        confidence: 0.9,
        concerns: [],
        reasonCodes: [],
        summary: 'Eligible.',
        scratchpad:
          'RULE_1_TECHNICAL_ALIGNMENT: PASS | Evidence: computing role | Reason: meets criteria',
      },
    },
    sources: [],
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

async function provisionUser(
  role: 'student' | 'coordinator',
  email: string,
  platformUserId: string,
  firebaseUid: string
): Promise<void> {
  const now = new Date()
  await new FirestoreUnitOfWork().execute(async (ctx) => {
    await ctx.users.save(
      User.create({
        id: platformUserId,
        version: 0,
        email,
        role,
        status: 'active',
        onboardingStage: 'profile_complete',
        identity: UserIdentity.create({
          provider: 'firebase',
          providerUserId: firebaseUid,
          emailSnapshot: email,
        }),
        createdAt: now,
        updatedAt: now,
        displayName: undefined,
        studentProfile: undefined,
      })
    )
  })
  trackDoc('users', platformUserId)
}

async function makeCoordinator() {
  const firebaseUid = `fb_${randomUUID()}`
  const email = `coord_${randomUUID().slice(0, 6)}@rmit.edu.au`
  const platformUserId = `usr_coord_${randomUUID()}`
  const idToken = await mintEmulatorIdToken(firebaseUid, email)
  await provisionUser('coordinator', email, platformUserId, firebaseUid)
  return { idToken }
}

async function makeStudent() {
  const firebaseUid = `fb_${randomUUID()}`
  const email = `student_${randomUUID().slice(0, 6)}@student.rmit.edu.au`
  const platformUserId = `usr_student_${randomUUID()}`
  const idToken = await mintEmulatorIdToken(firebaseUid, email)
  await provisionUser('student', email, platformUserId, firebaseUid)
  return { idToken }
}

describe('/api/v1/coordinator/ai — component', () => {
  beforeAll(() => {
    initEmulator()
    process.env['RAG_SERVICE_URL'] = RAG_TEST_URL
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await clearDocs()
    await clearAuthUsers()
  })

  describe('POST /chat', () => {
    it('returns 200 with RAG response for coordinator', async () => {
      const { idToken } = await makeCoordinator()
      mockFetch(200, checkerResponse({ feature: 'faq-rag' }))

      const res = await request(createApp())
        .post('/api/v1/coordinator/ai/chat')
        .set('Authorization', `Bearer ${idToken}`)
        .send({ userInput: 'What are the award classification rules?' })

      expect(res.status).toBe(200)
    })

    it('returns 403 when student token used', async () => {
      const { idToken } = await makeStudent()

      const res = await request(createApp())
        .post('/api/v1/coordinator/ai/chat')
        .set('Authorization', `Bearer ${idToken}`)
        .send({ userInput: 'test' })

      expect(res.status).toBe(403)
    })

    it('returns 422 when userInput is missing', async () => {
      const { idToken } = await makeCoordinator()

      const res = await request(createApp())
        .post('/api/v1/coordinator/ai/chat')
        .set('Authorization', `Bearer ${idToken}`)
        .send({})

      expect(res.status).toBe(422)
    })

    it('returns 401 when no auth token provided', async () => {
      const res = await request(createApp())
        .post('/api/v1/coordinator/ai/chat')
        .send({ userInput: 'test' })

      expect(res.status).toBe(401)
    })
  })

  describe('POST /job-check', () => {
    it('returns 200 and forwards feature=job-checker for coordinator', async () => {
      const { idToken } = await makeCoordinator()
      let capturedBody: Record<string, unknown> | undefined
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = typeof input === 'string' ? input : (input as Request).url
        if (url.startsWith(RAG_TEST_URL)) {
          capturedBody = JSON.parse((init?.body as string) ?? '{}') as Record<string, unknown>
          return new Response(JSON.stringify(checkerResponse()), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        }
        return fetch(input, init)
      })

      const res = await request(createApp())
        .post('/api/v1/coordinator/ai/job-check')
        .set('Authorization', `Bearer ${idToken}`)
        .send({ userInput: 'Job Title: Software Engineer\nEmployer: ACME Corp' })

      expect(res.status).toBe(200)
      expect(capturedBody?.feature).toBe('job-checker')
    })

    it('returns 403 when student token used', async () => {
      const { idToken } = await makeStudent()

      const res = await request(createApp())
        .post('/api/v1/coordinator/ai/job-check')
        .set('Authorization', `Bearer ${idToken}`)
        .send({ userInput: 'test' })

      expect(res.status).toBe(403)
    })

    it('returns 422 when userInput is empty', async () => {
      const { idToken } = await makeCoordinator()

      const res = await request(createApp())
        .post('/api/v1/coordinator/ai/job-check')
        .set('Authorization', `Bearer ${idToken}`)
        .send({ userInput: '' })

      expect(res.status).toBe(422)
    })

    it('returns 502 when upstream returns non-2xx', async () => {
      const { idToken } = await makeCoordinator()
      mockFetch(500, { error: 'Internal Server Error' })

      const res = await request(createApp())
        .post('/api/v1/coordinator/ai/job-check')
        .set('Authorization', `Bearer ${idToken}`)
        .send({ userInput: 'some job description' })

      expect(res.status).toBe(502)
    })

    it('returns 503 when RAG_SERVICE_URL is not configured', async () => {
      const { idToken } = await makeCoordinator()
      const original = process.env['RAG_SERVICE_URL']
      delete process.env['RAG_SERVICE_URL']

      try {
        const res = await request(createApp())
          .post('/api/v1/coordinator/ai/job-check')
          .set('Authorization', `Bearer ${idToken}`)
          .send({ userInput: 'some job description' })

        expect(res.status).toBe(503)
      } finally {
        process.env['RAG_SERVICE_URL'] = original
      }
    })
  })

  describe('POST /contract-check', () => {
    it('returns 200 and forwards feature=contract-checker for coordinator', async () => {
      const { idToken } = await makeCoordinator()
      let capturedBody: Record<string, unknown> | undefined
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = typeof input === 'string' ? input : (input as Request).url
        if (url.startsWith(RAG_TEST_URL)) {
          capturedBody = JSON.parse((init?.body as string) ?? '{}') as Record<string, unknown>
          return new Response(JSON.stringify(checkerResponse({ feature: 'contract-checker' })), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        }
        return fetch(input, init)
      })

      const res = await request(createApp())
        .post('/api/v1/coordinator/ai/contract-check')
        .set('Authorization', `Bearer ${idToken}`)
        .send({ userInput: 'Student: John Doe\nEmployer: ACME Corp' })

      expect(res.status).toBe(200)
      expect(capturedBody?.feature).toBe('contract-checker')
    })

    it('returns 403 when student token used', async () => {
      const { idToken } = await makeStudent()

      const res = await request(createApp())
        .post('/api/v1/coordinator/ai/contract-check')
        .set('Authorization', `Bearer ${idToken}`)
        .send({ userInput: 'test' })

      expect(res.status).toBe(403)
    })
  })
})
