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
  const email = `${randomUUID().slice(0, 8)}@student.rmit.edu.au`
  const initialToken = await mintEmulatorIdToken(firebaseUid, email)

  const create = await request(app)
    .post('/api/v1/auth/sync')
    .set('Authorization', `Bearer ${initialToken}`)
    .send({ studentNumber: `s${Math.floor(Math.random() * 1e9)}` })
  expect(create.status).toBe(201)
  trackDoc('users', create.body.id)

  // Subsequent calls use a refreshed token (picks up the claims set by sync).
  const authedToken = await mintEmulatorIdToken(firebaseUid, email)
  return { id: create.body.id as string, firebaseUid, email, idToken: authedToken }
}

async function makeCoordinator() {
  const firebaseUid = `fb_${randomUUID()}`
  const email = `coord_${randomUUID().slice(0, 6)}@rmit.edu.au`
  const platformUserId = `usr_coord_${randomUUID()}`
  await adminAuth.createUser({ uid: firebaseUid, email })
  await adminAuth.setCustomUserClaims(firebaseUid, { platformUserId, role: 'coordinator' })
  // Note: coordinators in this project are provisioned out-of-band — no
  // Firestore doc is required to exercise coordinator-role routes.
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
    expect(res.headers['etag']).toMatch(/^W\/"\d+"$/)
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
