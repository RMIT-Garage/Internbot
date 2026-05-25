/**
 * Component — GET /api/v1/users/:id and PATCH /api/v1/users/:id
 *
 * One `it(...)` per bullet in Phase 1's Success criteria / Bug-finding cases.
 * Zero mocks: real emulator, real tokens, real Firestore writes.
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
import { adminAuth } from '../../../src/infrastructure/config/firebase-admin'
import { FirestoreUnitOfWork } from '../../../src/infrastructure/firestore/firestore-unit-of-work'
import { User } from '../../../src/domain/entities/user'
import { UserIdentity } from '../../../src/domain/value-objects/user-identity'

const completePatch = {
  studentProfile: {
    programCode: 'BP096',
    academicInfo: {
      programName: 'Bachelor of Software Engineering',
      programLevel: 'undergraduate',
      unitsAttempted: 192,
      creditUnitsEarned: 168,
      gpa: 3.2,
      currentStudyLoad: 'full_time',
    },
  },
}

async function syncStudent(app: ReturnType<typeof createApp>) {
  const firebaseUid = `fb_${randomUUID()}`
  const studentNumber = `s${Math.floor(Math.random() * 1e9)}`
  const email = `${studentNumber}@student.rmit.edu.au`
  const idToken = await mintEmulatorIdToken(firebaseUid, email)

  // Pattern B: any authenticated request triggers JIT bootstrap in the
  // hydrator middleware. We hit GET /me to receive the freshly-created id.
  const me = await request(app).get('/api/v1/users/me').set('Authorization', `Bearer ${idToken}`)
  expect(me.status).toBe(200)
  trackDoc('users', me.body.id)
  return { id: me.body.id as string, firebaseUid, email, idToken }
}

async function makeCoordinator() {
  // Coordinators bypass JIT: their `users/{id}` doc + Firebase Auth user must
  // exist before the middleware sees them. Provision both atomically here.
  const firebaseUid = `fb_${randomUUID()}`
  const email = `coord_${randomUUID().slice(0, 6)}@rmit.edu.au`
  const platformUserId = `usr_coord_${randomUUID()}`
  await adminAuth.createUser({ uid: firebaseUid, email })

  const uow = new FirestoreUnitOfWork()
  await uow.execute(async (ctx) => {
    const now = new Date()
    const coord = User.create({
      id: platformUserId,
      version: 0,
      email,
      role: 'coordinator',
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
    await ctx.users.save(coord)
  })
  trackDoc('users', platformUserId)

  const idToken = await mintEmulatorIdToken(firebaseUid, email)
  return { firebaseUid, email, platformUserId, idToken }
}

describe('GET /api/v1/users/:id — component', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
    await clearAuthUsers()
  })

  it('GET /users/me resolves to caller and sets ETag header; firebaseUid is not leaked', async () => {
    const app = createApp()
    const student = await syncStudent(app)

    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${student.idToken}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(student.id)
    // First persisted version is always 1 (the JIT bootstrap is the
    // first save).
    expect(res.headers['etag']).toBe('W/"1"')
    expect(res.body.firebaseUid).toBeUndefined()
  })

  it('coordinator can read any student record', async () => {
    const app = createApp()
    const student = await syncStudent(app)
    const coordinator = await makeCoordinator()

    const res = await request(app)
      .get(`/api/v1/users/${student.id}`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(student.id)
  })

  it('student reading another student returns 403 student_not_owner', async () => {
    const app = createApp()
    const owner = await syncStudent(app)
    const other = await syncStudent(app)

    const res = await request(app)
      .get(`/api/v1/users/${owner.id}`)
      .set('Authorization', `Bearer ${other.idToken}`)

    expect(res.status).toBe(403)
    expect(res.body.error.reason).toBe('student_not_owner')
  })

  it('returns 404 for an unknown id when called by a coordinator', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()

    const res = await request(app)
      .get(`/api/v1/users/usr_${randomUUID()}`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)

    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/v1/users/:id — component', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
    await clearAuthUsers()
  })

  it('owner with all required academic fields → 200, profileStatus=complete, confirmedAt set', async () => {
    const app = createApp()
    const student = await syncStudent(app)

    const res = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${student.idToken}`)
      .send(completePatch)

    expect(res.status).toBe(200)
    expect(res.body.studentProfile.profileStatus).toBe('complete')
    expect(res.body.studentProfile.academicInfo.confirmedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    // Successful PATCH bumps the version monotonically: sync seeded v1, this PATCH → v2.
    expect(res.headers['etag']).toBe('W/"2"')
  })

  it('student sets displayName via PATCH → 200, response reflects the new name', async () => {
    const app = createApp()
    const student = await syncStudent(app)

    const res = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({ displayName: 'Alex Chen' })

    expect(res.status).toBe(200)
    expect(res.body.displayName).toBe('Alex Chen')
  })

  it('PATCH with neither displayName nor studentProfile fields returns 422 empty_body', async () => {
    const app = createApp()
    const student = await syncStudent(app)

    const res = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({ studentProfile: {} })

    expect(res.status).toBe(422)
    expect(res.body.error.reason).toBe('empty_body')
  })

  it('attempt to change studentNumber to a new value returns 422 immutable_field', async () => {
    const app = createApp()
    const student = await syncStudent(app)

    const res = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({ studentProfile: { studentNumber: `s${Math.floor(Math.random() * 1e9)}` } })

    expect(res.status).toBe(422)
    expect(res.body.error.reason).toBe('immutable_field')
  })

  it('coordinator PATCH returns 405 with Allow: GET', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()

    const res = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send(completePatch)

    expect(res.status).toBe(405)
    expect(res.headers['allow']).toBe('GET')
  })

  it('stale If-Match returns 412 etag_mismatch', async () => {
    const app = createApp()
    const student = await syncStudent(app)

    const res = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${student.idToken}`)
      .set('If-Match', 'W/"0"')
      .send(completePatch)

    expect(res.status).toBe(412)
    expect(res.body.error.reason).toBe('etag_mismatch')
  })

  it('writing non-writable top-level fields (role/email/firebaseUid/etc.) returns 400 immutable_field', async () => {
    const app = createApp()
    const student = await syncStudent(app)

    const res = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({ role: 'coordinator', studentProfile: {} })

    expect(res.status).toBe(400)
    expect(res.body.error.reason).toBe('immutable_field')
    expect(res.body.error.fields.some((f: { field: string }) => f.field === 'role')).toBe(true)
  })

  it('student PATCH on another user returns 403 student_not_owner', async () => {
    const app = createApp()
    const owner = await syncStudent(app)
    const other = await syncStudent(app)

    const res = await request(app)
      .patch(`/api/v1/users/${owner.id}`)
      .set('Authorization', `Bearer ${other.idToken}`)
      .send(completePatch)

    expect(res.status).toBe(403)
    expect(res.body.error.reason).toBe('student_not_owner')
  })

  it('PATCH that leaves a required academicInfo field missing keeps profileStatus incomplete', async () => {
    const app = createApp()
    const student = await syncStudent(app)

    const res = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({ studentProfile: { programCode: 'BP096' } })

    expect(res.status).toBe(200)
    expect(res.body.studentProfile.profileStatus).toBe('incomplete')
    expect(res.body.studentProfile.academicInfo).toBeNull()
  })

  it('confirmedAt is NOT re-written on edits after the profile is already complete', async () => {
    const app = createApp()
    const student = await syncStudent(app)

    const first = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${student.idToken}`)
      .send(completePatch)
    expect(first.status).toBe(200)
    const firstConfirmedAt = first.body.studentProfile.academicInfo.confirmedAt as string

    const second = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({
        studentProfile: {
          academicInfo: { ...completePatch.studentProfile.academicInfo, gpa: 3.4 },
        },
      })
    expect(second.status).toBe(200)
    expect(second.body.studentProfile.academicInfo.confirmedAt).toBe(firstConfirmedAt)
  })
})

/**
 * Status-code regression: a Firebase-authenticated caller whose JIT
 * bootstrap could not run (non-student-shape email here) must receive
 * 403, not 401. The token is valid; the caller just has no platform
 * identity that the hydrator could create.
 *
 * Per spec §7.0: 401 = invalid/missing token; 403 = authenticated but
 * lacks permission. Same condition routed through the bare `:id` path
 * (handler throws ForbiddenError) returns 403 — `/me` aliases must match.
 */
describe('/me alias — caller without platform user returns 403, not 401', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
    await clearAuthUsers()
  })

  it.each([
    ['GET', '/api/v1/users/me'],
    ['PATCH', '/api/v1/users/me'],
    ['GET', '/api/v1/users/me/workflow'],
    ['PUT', '/api/v1/users/me/semester-selection'],
  ])('%s %s with no platform user → 403 no_platform_user', async (method, path) => {
    const app = createApp()
    // Caller is Firebase-authed with a non-student-shape email, so the
    // JIT bootstrap declines to create a `users/{id}` doc and the
    // hydrator returns null → `actor.platformUser === null`.
    const firebaseUid = `fb_${randomUUID()}`
    const idToken = await mintEmulatorIdToken(firebaseUid, 'a@b.com')

    const req = request(app)
    const send = (() => {
      switch (method) {
        case 'GET':
          return req.get(path)
        case 'PATCH':
          return req.patch(path).send({ studentProfile: { phone: '+61400000000' } })
        case 'PUT':
          return req.put(path).send({ semesterId: 'sem_anything' })
        default:
          throw new Error(`unexpected method ${method}`)
      }
    })()

    const res = await send.set('Authorization', `Bearer ${idToken}`)
    expect(res.status).toBe(403)
    expect(res.body.error.reason).toBe('no_platform_user')
  })
})
