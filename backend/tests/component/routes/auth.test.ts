/**
 * Component — POST /api/v1/auth/sync
 *
 * One `it(...)` per bullet in Phase 1's Success criteria / Bug-finding cases
 * (docs/WORKFLOW-API-IMPLEMENTATION-PLAN.md). Zero mocks: real Firestore
 * emulator, real Firebase Auth emulator, real tokens, real claims writes.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import request from 'supertest'
import { randomUUID } from 'node:crypto'
import { createApp } from '../../../src/api/app'
import {
  initEmulator,
  clearDocs,
  clearAuthUsers,
  trackDoc,
  mintEmulatorIdToken,
} from '../../setup.emulator'
import { adminAuth, adminDb } from '../../../src/infrastructure/config/firebase-admin'

function buildFreshUid() {
  return {
    firebaseUid: `fb_${randomUUID()}`,
    email: `${randomUUID().slice(0, 8)}@student.rmit.edu.au`,
  }
}

describe('POST /api/v1/auth/sync — component', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
    await clearAuthUsers()
  })

  it('first call returns 201 with Location, role=student, profileStatus=incomplete, no firebaseUid leaked, and sets Firebase custom claims', async () => {
    const app = createApp()
    const { firebaseUid, email } = buildFreshUid()
    const idToken = await mintEmulatorIdToken(firebaseUid, email)
    const studentNumber = `s${Math.floor(Math.random() * 1e9)}`

    const res = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ studentNumber })

    expect(res.status).toBe(201)
    expect(res.headers['location']).toMatch(/^\/api\/v1\/users\//)
    expect(res.body.role).toBe('student')
    expect(res.body.studentProfile.profileStatus).toBe('incomplete')
    expect(res.body.firebaseUid).toBeUndefined()

    trackDoc('users', res.body.id)

    // Real claims must now be on the Firebase Auth user in the emulator.
    const authRecord = await adminAuth.getUser(firebaseUid)
    expect(authRecord.customClaims).toEqual({ platformUserId: res.body.id, role: 'student' })
  })

  it('repeat call (token already carries claims) returns 200 with the same id', async () => {
    const app = createApp()
    const { firebaseUid, email } = buildFreshUid()
    const firstToken = await mintEmulatorIdToken(firebaseUid, email)

    const first = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${firstToken}`)
      .send({ studentNumber: `s${Math.floor(Math.random() * 1e9)}` })
    expect(first.status).toBe(201)
    trackDoc('users', first.body.id)

    // Mint a new ID token that now carries the claims set by the first call.
    const refreshedToken = await mintEmulatorIdToken(firebaseUid, email)
    const second = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${refreshedToken}`)
      .send({})

    expect(second.status).toBe(200)
    expect(second.body.id).toBe(first.body.id)
  })

  it('first-time student without studentNumber returns 422 missing_required_field', async () => {
    const app = createApp()
    const { firebaseUid, email } = buildFreshUid()
    const idToken = await mintEmulatorIdToken(firebaseUid, email)

    const res = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${idToken}`)
      .send({})

    expect(res.status).toBe(422)
    expect(res.body.error.reason).toBe('missing_required_field')
    expect(res.body.error.fields[0].field).toBe('studentNumber')
  })

  it('returns 401 when the Authorization header is missing', async () => {
    const app = createApp()
    const res = await request(app).post('/api/v1/auth/sync').send({})
    expect(res.status).toBe(401)
  })

  it('returns 401 when the Authorization header is present but the token is invalid', async () => {
    const app = createApp()
    const res = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ studentNumber: 's1234567' })
    expect(res.status).toBe(401)
  })

  it('writes exactly one users document even when called concurrently for the same firebaseUid', async () => {
    const app = createApp()
    const { firebaseUid, email } = buildFreshUid()
    const idToken = await mintEmulatorIdToken(firebaseUid, email)
    const studentNumber = `s${Math.floor(Math.random() * 1e9)}`

    const [a, b] = await Promise.all([
      request(app)
        .post('/api/v1/auth/sync')
        .set('Authorization', `Bearer ${idToken}`)
        .send({ studentNumber }),
      request(app)
        .post('/api/v1/auth/sync')
        .set('Authorization', `Bearer ${idToken}`)
        .send({ studentNumber }),
    ])

    expect([a.status, b.status].sort()).toEqual([200, 201])
    expect(a.body.id).toBe(b.body.id)
    trackDoc('users', a.body.id)

    const query = await adminDb.collection('users').where('firebaseUid', '==', firebaseUid).get()
    expect(query.size).toBe(1)
  })
})
