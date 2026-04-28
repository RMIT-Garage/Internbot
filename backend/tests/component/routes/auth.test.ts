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

    const identity = await adminDb
      .collection('userIdentities')
      .doc(`firebase__${encodeURIComponent(firebaseUid)}`)
      .get()
    expect(identity.data()?.['userId']).toBe(a.body.id)

    const user = await adminDb.collection('users').doc(a.body.id).get()
    expect(user.exists).toBe(true)
    expect(user.data()?.['firebaseUid']).toBeUndefined()
  })
})

/**
 * Extensive JIT-bootstrap cases — Firebase ID-token format & idempotency.
 *
 * The frontend (`AuthProvider.tsx` → `apiFetch` → `getIdToken()`) sends the
 * exact JWT format minted by `mintEmulatorIdToken()`: a real Firebase ID
 * token (3-segment JWT) in `Authorization: Bearer <token>`. These tests
 * exercise that full path end-to-end against the Firebase Auth emulator.
 */
describe('POST /api/v1/auth/sync — token format & JIT bootstrap (extensive)', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
    await clearAuthUsers()
  })

  // -------------------- JWT format sanity --------------------

  it('emulator-minted token is a valid 3-segment JWT carrying the firebaseUid as `sub` and `user_id`', async () => {
    const { firebaseUid, email } = buildFreshUid()
    const idToken = await mintEmulatorIdToken(firebaseUid, email)

    const segments = idToken.split('.')
    expect(segments).toHaveLength(3)

    const decode = (b64url: string): unknown => {
      const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
      return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
    }
    const header = decode(segments[0]!) as { alg: string; typ: string }
    const payload = decode(segments[1]!) as {
      sub: string
      user_id: string
      email?: string
      iss: string
      aud: string
      iat: number
      exp: number
    }

    expect(header.typ).toBe('JWT')
    expect(payload.sub).toBe(firebaseUid)
    expect(payload.user_id).toBe(firebaseUid)
    expect(payload.email).toBe(email)
    expect(payload.iss).toContain('securetoken')
    expect(payload.exp).toBeGreaterThan(payload.iat)
  })

  // -------------------- Authorization header parsing --------------------

  it.each([
    ['lowercase "bearer " scheme', (t: string) => `bearer ${t}`],
    ['"Basic" scheme', (t: string) => `Basic ${t}`],
    ['no scheme prefix (raw token)', (t: string) => t],
    ['"Bearer" without trailing space', (t: string) => `Bearer${t}`],
    ['empty value after "Bearer "', () => 'Bearer '],
  ])('rejects malformed Authorization header: %s → 401', async (_label, build) => {
    const app = createApp()
    const idToken = await mintEmulatorIdToken(`fb_${randomUUID()}`, 'a@b.com')
    const res = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', build(idToken))
      .send({ studentNumber: 's1234567' })
    expect(res.status).toBe(401)
  })

  it('rejects a JWT whose signature byte was flipped → 401', async () => {
    const app = createApp()
    const idToken = await mintEmulatorIdToken(`fb_${randomUUID()}`, 'a@b.com')
    // Flip a character in the signature segment so the token deserializes
    // but verification fails — distinct from the "garbage string" case.
    const segments = idToken.split('.')
    const sig = segments[2]!
    const flippedChar = sig[0] === 'A' ? 'B' : 'A'
    const tampered = `${segments[0]}.${segments[1]}.${flippedChar}${sig.slice(1)}`
    const res = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${tampered}`)
      .send({ studentNumber: 's1234567' })
    expect(res.status).toBe(401)
  })

  it('rejects a JWT with only two segments (truncated) → 401', async () => {
    const app = createApp()
    const idToken = await mintEmulatorIdToken(`fb_${randomUUID()}`, 'a@b.com')
    const [h, p] = idToken.split('.')
    const res = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${h}.${p}`)
      .send({ studentNumber: 's1234567' })
    expect(res.status).toBe(401)
  })

  // -------------------- Repeat-call behavior --------------------

  it('repeat call updates displayName when a new value is supplied', async () => {
    const app = createApp()
    const { firebaseUid, email } = buildFreshUid()
    const idToken = await mintEmulatorIdToken(firebaseUid, email)

    const first = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ studentNumber: `s${Math.floor(Math.random() * 1e9)}`, displayName: 'Old Name' })
    expect(first.status).toBe(201)
    trackDoc('users', first.body.id)
    expect(first.body.displayName).toBe('Old Name')

    const refreshed = await mintEmulatorIdToken(firebaseUid, email)
    const second = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${refreshed}`)
      .send({ displayName: 'New Name' })
    expect(second.status).toBe(200)
    expect(second.body.id).toBe(first.body.id)
    expect(second.body.displayName).toBe('New Name')
  })

  it('repeat call without studentNumber leaves the original studentNumber intact', async () => {
    const app = createApp()
    const { firebaseUid, email } = buildFreshUid()
    const idToken = await mintEmulatorIdToken(firebaseUid, email)
    const studentNumber = `s${Math.floor(Math.random() * 1e9)}`

    const first = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ studentNumber })
    expect(first.status).toBe(201)
    trackDoc('users', first.body.id)

    const refreshed = await mintEmulatorIdToken(firebaseUid, email)
    const second = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${refreshed}`)
      .send({})
    expect(second.status).toBe(200)
    expect(second.body.studentProfile.studentNumber).toBe(studentNumber)
  })

  it('re-affirms Firebase custom claims on every successful call (idempotent)', async () => {
    const app = createApp()
    const { firebaseUid, email } = buildFreshUid()
    const idToken = await mintEmulatorIdToken(firebaseUid, email)

    const first = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ studentNumber: `s${Math.floor(Math.random() * 1e9)}` })
    expect(first.status).toBe(201)
    trackDoc('users', first.body.id)
    const claimsAfterFirst = (await adminAuth.getUser(firebaseUid)).customClaims
    expect(claimsAfterFirst).toEqual({ platformUserId: first.body.id, role: 'student' })

    // Wipe claims out-of-band, then call again. A correctly idempotent
    // bootstrap re-attaches them from the persisted user record.
    await adminAuth.setCustomUserClaims(firebaseUid, null)
    expect((await adminAuth.getUser(firebaseUid)).customClaims).toEqual({})

    const refreshed = await mintEmulatorIdToken(firebaseUid, email)
    const second = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${refreshed}`)
      .send({})
    expect(second.status).toBe(200)
    expect((await adminAuth.getUser(firebaseUid)).customClaims).toEqual({
      platformUserId: first.body.id,
      role: 'student',
    })
  })

  // -------------------- Multi-user isolation --------------------

  it('two distinct Firebase users produce two distinct platform users', async () => {
    const app = createApp()
    const a = buildFreshUid()
    const b = buildFreshUid()
    const tokenA = await mintEmulatorIdToken(a.firebaseUid, a.email)
    const tokenB = await mintEmulatorIdToken(b.firebaseUid, b.email)

    const [resA, resB] = await Promise.all([
      request(app)
        .post('/api/v1/auth/sync')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ studentNumber: `s${Math.floor(Math.random() * 1e9)}` }),
      request(app)
        .post('/api/v1/auth/sync')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ studentNumber: `s${Math.floor(Math.random() * 1e9)}` }),
    ])

    expect(resA.status).toBe(201)
    expect(resB.status).toBe(201)
    expect(resA.body.id).not.toBe(resB.body.id)
    expect(resA.body.email).toBe(a.email)
    expect(resB.body.email).toBe(b.email)
    trackDoc('users', resA.body.id)
    trackDoc('users', resB.body.id)
  })

  it('the same firebaseUid resolves to the same platform user across many sequential calls', async () => {
    const app = createApp()
    const { firebaseUid, email } = buildFreshUid()
    const initial = await mintEmulatorIdToken(firebaseUid, email)
    const first = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${initial}`)
      .send({ studentNumber: `s${Math.floor(Math.random() * 1e9)}` })
    expect(first.status).toBe(201)
    trackDoc('users', first.body.id)

    for (let i = 0; i < 4; i++) {
      const t = await mintEmulatorIdToken(firebaseUid, email)
      const r = await request(app)
        .post('/api/v1/auth/sync')
        .set('Authorization', `Bearer ${t}`)
        .send({})
      expect(r.status).toBe(200)
      expect(r.body.id).toBe(first.body.id)
    }
  })

  // -------------------- Storage shape --------------------

  it('first-call write produces the documented Firestore shape', async () => {
    const app = createApp()
    const { firebaseUid, email } = buildFreshUid()
    const idToken = await mintEmulatorIdToken(firebaseUid, email)
    const studentNumber = `s${Math.floor(Math.random() * 1e9)}`

    const res = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ studentNumber })
    expect(res.status).toBe(201)
    trackDoc('users', res.body.id)

    const userDoc = await adminDb.collection('users').doc(res.body.id).get()
    const userData = userDoc.data() as Record<string, unknown>
    expect(userData['email']).toBe(email)
    expect(userData['role']).toBe('student')
    expect(userData['status']).toBe('active')
    expect(userData['onboardingStage']).toBe('profile_pending')
    expect(userData['version']).toBe(1)
    expect(userData['firebaseUid']).toBeUndefined()
    expect(userData['createdAt']).toBeDefined()
    expect(userData['updatedAt']).toBeDefined()
    expect((userData['studentProfile'] as Record<string, unknown>)['studentNumber']).toBe(
      studentNumber
    )
    expect((userData['studentProfile'] as Record<string, unknown>)['profileStatus']).toBe(
      'incomplete'
    )

    // Slim sentinel — uniqueness lock only, just back-pointer.
    const sentinelDoc = await adminDb
      .collection('userIdentities')
      .doc(`firebase__${encodeURIComponent(firebaseUid)}`)
      .get()
    expect(sentinelDoc.data()?.['userId']).toBe(res.body.id)

    // Identity data is denormalised onto the user doc.
    const userIdentity = userData['identity'] as Record<string, unknown>
    expect(userIdentity['provider']).toBe('firebase')
    expect(userIdentity['providerUserId']).toBe(firebaseUid)
    expect(userIdentity['emailSnapshot']).toBe(email)
  })

  // -------------------- Response headers --------------------

  it('first-call 201 sets ETag, Cache-Control, and Location headers', async () => {
    const app = createApp()
    const { firebaseUid, email } = buildFreshUid()
    const idToken = await mintEmulatorIdToken(firebaseUid, email)

    const res = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ studentNumber: `s${Math.floor(Math.random() * 1e9)}` })
    expect(res.status).toBe(201)
    trackDoc('users', res.body.id)
    expect(res.headers['etag']).toMatch(/^W\/"\d+"$/)
    expect(res.headers['cache-control']).toBe('private, no-cache')
    expect(res.headers['location']).toBe(`/api/v1/users/${res.body.id}`)
  })

  it('repeat 200 sets ETag and Cache-Control but no Location', async () => {
    const app = createApp()
    const { firebaseUid, email } = buildFreshUid()
    const idToken = await mintEmulatorIdToken(firebaseUid, email)

    const first = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ studentNumber: `s${Math.floor(Math.random() * 1e9)}` })
    expect(first.status).toBe(201)
    trackDoc('users', first.body.id)

    const refreshed = await mintEmulatorIdToken(firebaseUid, email)
    const second = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${refreshed}`)
      .send({})
    expect(second.status).toBe(200)
    expect(second.headers['etag']).toMatch(/^W\/"\d+"$/)
    expect(second.headers['cache-control']).toBe('private, no-cache')
    expect(second.headers['location']).toBeUndefined()
  })

  // -------------------- Body validation --------------------

  it('rejects unknown top-level fields with 400 (strict body schema)', async () => {
    const app = createApp()
    const { firebaseUid, email } = buildFreshUid()
    const idToken = await mintEmulatorIdToken(firebaseUid, email)

    const res = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ studentNumber: 's1234567', role: 'coordinator' })
    expect(res.status).toBe(400)
  })

  it('rejects empty-string studentNumber on first call (zod min(1)) with 400', async () => {
    const app = createApp()
    const { firebaseUid, email } = buildFreshUid()
    const idToken = await mintEmulatorIdToken(firebaseUid, email)

    const res = await request(app)
      .post('/api/v1/auth/sync')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ studentNumber: '' })
    expect(res.status).toBe(400)
  })
})
