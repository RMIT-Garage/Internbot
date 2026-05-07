/**
 * Component — `/api/v1/semesters` routes (Phase 2).
 *
 * One `it(...)` per bullet in Phase 2's Success criteria + Bug-finding cases
 * in WORKFLOW-API-IMPLEMENTATION-PLAN.md. Zero mocks: real emulator, real
 * tokens, real Firestore writes.
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
import { adminDb } from '../../../src/infrastructure/config/firebase-admin'
import { FirestoreUnitOfWork } from '../../../src/infrastructure/firestore/firestore-unit-of-work'
import { User } from '../../../src/domain/entities/user'
import { UserIdentity } from '../../../src/domain/value-objects/user-identity'

function uniqueSemesterCode(): string {
  return `2026-S${randomUUID()
    .slice(0, 8)
    .replace(/[^A-Za-z0-9]/g, 'a')}`
}

function uniqueCourseCode(): string {
  return `INTE${Math.floor(Math.random() * 9000 + 1000)}`
}

async function provisionUser(
  role: 'student' | 'coordinator',
  email: string,
  platformUserId: string,
  firebaseUid: string
): Promise<void> {
  // Pattern B: identity is read from Firestore at the edge. Tests pre-seed
  // both `users/{id}` and the `userIdentities/{provider}__{uid}` sentinel
  // atomically so the auth middleware's hydrator resolves the caller in one
  // lookup and never enters the JIT branch.
  const uow = new FirestoreUnitOfWork()
  await uow.execute(async (ctx) => {
    const now = new Date()
    const user = User.create({
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
    await ctx.users.save(user)
  })
  trackDoc('users', platformUserId)
}

async function makeCoordinator() {
  const firebaseUid = `fb_${randomUUID()}`
  const email = `coord_${randomUUID().slice(0, 6)}@rmit.edu.au`
  const platformUserId = `usr_coord_${randomUUID()}`
  // mintEmulatorIdToken creates the Firebase Auth user with emailVerified=true.
  const idToken = await mintEmulatorIdToken(firebaseUid, email)
  await provisionUser('coordinator', email, platformUserId, firebaseUid)
  return { firebaseUid, email, platformUserId, idToken }
}

async function makeStudent() {
  const firebaseUid = `fb_${randomUUID()}`
  const email = `student_${randomUUID().slice(0, 6)}@student.rmit.edu.au`
  const platformUserId = `usr_student_${randomUUID()}`
  const idToken = await mintEmulatorIdToken(firebaseUid, email)
  await provisionUser('student', email, platformUserId, firebaseUid)
  return { firebaseUid, email, platformUserId, idToken }
}

function validCreateBody(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    semesterCode: uniqueSemesterCode(),
    courseCode: uniqueCourseCode(),
    displayName: 'Semester 1 2026',
    status: 'draft' as const,
    ...overrides,
  }
}

async function createDraftSemester(
  app: ReturnType<typeof createApp>,
  coordinator: { idToken: string },
  body = validCreateBody()
): Promise<{ id: string; etag: string; body: typeof body }> {
  const res = await request(app)
    .post('/api/v1/semesters')
    .set('Authorization', `Bearer ${coordinator.idToken}`)
    .send(body)
  expect(res.status).toBe(201)
  trackDoc('semesters', res.body.id)
  return { id: res.body.id, etag: res.headers['etag']!, body }
}

describe('POST /api/v1/semesters — component', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
    await clearAuthUsers()
  })

  it('coordinator with valid body → 201 with Location header', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const body = validCreateBody()

    const res = await request(app)
      .post('/api/v1/semesters')
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send(body)

    expect(res.status).toBe(201)
    trackDoc('semesters', res.body.id)
    expect(res.headers['location']).toBe(`/api/v1/semesters/${res.body.id}`)
    // First persisted version is always 1 (create is the first save).
    expect(res.headers['etag']).toBe('W/"1"')
    expect(res.body.semesterCode).toBe(body.semesterCode)
    expect(res.body.courseCode).toBe(body.courseCode)
    expect(res.body.status).toBe('draft')
  })

  it('student → 403 role_restricted_action', async () => {
    const app = createApp()
    const student = await makeStudent()

    const res = await request(app)
      .post('/api/v1/semesters')
      .set('Authorization', `Bearer ${student.idToken}`)
      .send(validCreateBody())

    expect(res.status).toBe(403)
    expect(res.body.error.reason).toBe('role_restricted_action')
  })

  it('duplicate (semesterCode, courseCode) → 409 natural_key_exists', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const body = validCreateBody()

    const first = await request(app)
      .post('/api/v1/semesters')
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send(body)
    expect(first.status).toBe(201)
    trackDoc('semesters', first.body.id)

    const dup = await request(app)
      .post('/api/v1/semesters')
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send(body)

    expect(dup.status).toBe(409)
    expect(dup.body.error.reason).toBe('natural_key_exists')
  })

  it('missing required fields → 422 missing_required_field', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()

    const res = await request(app)
      .post('/api/v1/semesters')
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send({ semesterCode: uniqueSemesterCode() })

    expect(res.status).toBe(422)
    expect(res.body.error.reason).toBe('missing_required_field')
  })

  // ---------------- Bug-finding case ----------------

  it('concurrent POST with same natural key → exactly one 201, the other 409', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const body = validCreateBody()

    const settled = await Promise.allSettled([
      request(app)
        .post('/api/v1/semesters')
        .set('Authorization', `Bearer ${coordinator.idToken}`)
        .send(body),
      request(app)
        .post('/api/v1/semesters')
        .set('Authorization', `Bearer ${coordinator.idToken}`)
        .send(body),
    ])
    const responses = settled
      .filter((s) => s.status === 'fulfilled')
      .map((s) => (s as PromiseFulfilledResult<{ status: number; body: { id?: string } }>).value)
    expect(responses.length).toBe(2)

    const successes = responses.filter((r) => r.status === 201)
    const conflicts = responses.filter((r) => r.status === 409)
    expect(successes.length).toBe(1)
    expect(conflicts.length).toBe(1)
    if (successes[0]?.body.id) trackDoc('semesters', successes[0].body.id)

    const dupQuery = await adminDb
      .collection('semesters')
      .where('semesterCode', '==', body.semesterCode)
      .where('courseCode', '==', body.courseCode)
      .get()
    expect(dupQuery.size).toBe(1)
  })
})

describe('PATCH /api/v1/semesters/:id — component', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
    await clearAuthUsers()
  })

  it('body containing immutable field (status) → 400 immutable_field', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const { id } = await createDraftSemester(app, coordinator)

    const res = await request(app)
      .patch(`/api/v1/semesters/${id}`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send({ status: 'active' })

    expect(res.status).toBe(400)
    expect(res.body.error.reason).toBe('immutable_field')
    expect((res.body.error.fields as { field: string }[]).some((f) => f.field === 'status')).toBe(
      true
    )
  })

  it('empty body → 422 empty_body', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const { id } = await createDraftSemester(app, coordinator)

    const res = await request(app)
      .patch(`/api/v1/semesters/${id}`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send({})

    expect(res.status).toBe(422)
    expect(res.body.error.reason).toBe('empty_body')
  })
})

describe('POST /api/v1/semesters/:id/transitions — component', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
    await clearAuthUsers()
  })

  it('draft → active → 201, activity record written with from/to/actorUserId', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const { id } = await createDraftSemester(app, coordinator)

    const res = await request(app)
      .post(`/api/v1/semesters/${id}/transitions`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send({ to: 'active', comment: 'kickoff' })

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('active')
    expect(res.headers['location']).toBe(`/api/v1/semesters/${id}`)
    // Successful transition bumps the version monotonically: create seeded v1, this transition → v2.
    expect(res.headers['etag']).toBe('W/"2"')

    const activity = await adminDb.collection('semesters').doc(id).collection('activity').get()
    expect(activity.size).toBe(1)
    const record = activity.docs[0]!.data()
    expect(record['from']).toBe('draft')
    expect(record['to']).toBe('active')
    expect(record['actorUserId']).toBe(coordinator.platformUserId)
  })

  it('archived → active → 409 invalid_state_transition', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const { id } = await createDraftSemester(app, coordinator)

    const archive = await request(app)
      .post(`/api/v1/semesters/${id}/transitions`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send({ to: 'archived' })
    expect(archive.status).toBe(201)

    const res = await request(app)
      .post(`/api/v1/semesters/${id}/transitions`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send({ to: 'active' })

    expect(res.status).toBe(409)
    expect(res.body.error.reason).toBe('invalid_state_transition')
  })

  it('stale If-Match → 412 etag_mismatch', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const { id } = await createDraftSemester(app, coordinator)

    const res = await request(app)
      .post(`/api/v1/semesters/${id}/transitions`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .set('If-Match', 'W/"0"')
      .send({ to: 'active' })

    expect(res.status).toBe(412)
    expect(res.body.error.reason).toBe('etag_mismatch')
  })

  // ---------------- Bug-finding case ----------------

  it('transition record + parent status update are atomic (both visible after success)', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const { id } = await createDraftSemester(app, coordinator)

    const res = await request(app)
      .post(`/api/v1/semesters/${id}/transitions`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send({ to: 'active' })
    expect(res.status).toBe(201)

    const [snap, activity] = await Promise.all([
      adminDb.collection('semesters').doc(id).get(),
      adminDb.collection('semesters').doc(id).collection('activity').get(),
    ])
    expect(snap.data()?.['status']).toBe('active')
    expect(activity.size).toBe(1)
  })
})

describe('GET /api/v1/semesters — pagination cursor↔sort binding', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
    await clearAuthUsers()
  })

  /**
   * The cursor encodes the sort key it was issued under. Resuming with a
   * different sort silently produces undefined Firestore ordering — the
   * binding check makes that mistake explicit (400) instead of returning a
   * partially-ordered, partially-correct page.
   */
  it('a token issued with sort=createdAt:desc resumes correctly under the same sort', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    // Three semesters so a limit=1 first page must produce a non-null cursor.
    await createDraftSemester(app, coordinator)
    await createDraftSemester(app, coordinator)
    await createDraftSemester(app, coordinator)

    const first = await request(app)
      .get('/api/v1/semesters?limit=1&sort=-createdAt')
      .set('Authorization', `Bearer ${coordinator.idToken}`)
    expect(first.status).toBe(200)
    expect(first.body.items).toHaveLength(1)
    expect(first.body.nextPageToken).toBeTruthy()

    const second = await request(app)
      .get(`/api/v1/semesters?limit=1&sort=-createdAt&pageToken=${first.body.nextPageToken}`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
    expect(second.status).toBe(200)
    expect(second.body.items).toHaveLength(1)
    expect(second.body.items[0].id).not.toBe(first.body.items[0].id)
  })

  it('rejects 400 sort_mismatch when the request changes the sort key mid-pagination', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    await createDraftSemester(app, coordinator)
    await createDraftSemester(app, coordinator)

    const first = await request(app)
      .get('/api/v1/semesters?limit=1&sort=-createdAt')
      .set('Authorization', `Bearer ${coordinator.idToken}`)
    expect(first.status).toBe(200)
    expect(first.body.nextPageToken).toBeTruthy()

    const mismatched = await request(app)
      .get(`/api/v1/semesters?limit=1&sort=enrolmentOpenAt&pageToken=${first.body.nextPageToken}`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
    expect(mismatched.status).toBe(400)
    expect(mismatched.body.error.reason).toBe('invalid_query')
    expect(mismatched.body.error.fields[0].field).toBe('pageToken')
    expect(mismatched.body.error.fields[0].code).toBe('sort_mismatch')
  })

  it('rejects 400 sort_mismatch when only the direction flips', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    await createDraftSemester(app, coordinator)
    await createDraftSemester(app, coordinator)

    const first = await request(app)
      .get('/api/v1/semesters?limit=1&sort=-createdAt')
      .set('Authorization', `Bearer ${coordinator.idToken}`)
    expect(first.status).toBe(200)
    expect(first.body.nextPageToken).toBeTruthy()

    const flipped = await request(app)
      .get(`/api/v1/semesters?limit=1&sort=createdAt&pageToken=${first.body.nextPageToken}`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
    expect(flipped.status).toBe(400)
    expect(flipped.body.error.fields[0].code).toBe('sort_mismatch')
  })
})
