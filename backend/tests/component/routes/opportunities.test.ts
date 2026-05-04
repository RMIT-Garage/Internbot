/**
 * Component — `/api/v1/opportunities` routes (Phase 4).
 *
 * One `it(...)` per bullet in Phase 4's Success criteria + Bug-finding cases
 * in WORKFLOW-API-IMPLEMENTATION-PLAN.md.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { randomUUID } from 'node:crypto'
import { createApp } from '../../../src/api/app'
import { CreateSemesterCommandHandler } from '../../../src/application/commands/create-semester'
import { TransitionSemesterCommandHandler } from '../../../src/application/commands/transition-semester'
import { FirestoreUnitOfWork } from '../../../src/infrastructure/firestore/firestore-unit-of-work'
import { firestoreIdGenerator } from '../../../src/infrastructure/firestore/firestore-id-generator'
import { adminDb } from '../../../src/infrastructure/config/firebase-admin'
import { User } from '../../../src/domain/entities/user'
import { UserIdentity } from '../../../src/domain/value-objects/user-identity'
import { StudentProfile } from '../../../src/domain/value-objects/student-profile'
import {
  clearAuthUsers,
  clearDocs,
  initEmulator,
  mintEmulatorIdToken,
  trackDoc,
} from '../../setup.emulator'

async function provisionUser(
  role: 'student' | 'coordinator',
  email: string,
  platformUserId: string,
  firebaseUid: string,
  semesterId?: string
): Promise<void> {
  const now = new Date()
  await new FirestoreUnitOfWork().execute(async (ctx) => {
    await ctx.users.create(
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
        studentProfile:
          role === 'student'
            ? StudentProfile.rehydrate({
                studentNumber: `s${randomUUID().slice(0, 8)}`,
                profileStatus: 'complete',
                programCode: 'BP096',
                phone: undefined,
                academicInfo: undefined,
                semesterId,
                semesterSelectedAt: semesterId ? now : undefined,
              })
            : undefined,
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
  return { firebaseUid, email, platformUserId, idToken }
}

async function makeStudent(semesterId?: string) {
  const firebaseUid = `fb_${randomUUID()}`
  const email = `student_${randomUUID().slice(0, 6)}@student.rmit.edu.au`
  const platformUserId = `usr_student_${randomUUID()}`
  const idToken = await mintEmulatorIdToken(firebaseUid, email)
  await provisionUser('student', email, platformUserId, firebaseUid, semesterId)
  return { firebaseUid, email, platformUserId, idToken }
}

async function createActiveSemester(): Promise<string> {
  const uow = new FirestoreUnitOfWork()
  const create = new CreateSemesterCommandHandler(uow, firestoreIdGenerator)
  const transition = new TransitionSemesterCommandHandler(uow)
  const actor = {
    firebaseUid: `fb_${randomUUID()}`,
    email: 'coord@rmit.edu.au',
    platformUser: { id: `usr_coord_${randomUUID()}`, role: 'coordinator' as const },
  }
  const { id } = await create.handle({
    actor,
    payload: {
      semesterCode: `2026-S${randomUUID()
        .slice(0, 4)
        .replace(/[^A-Za-z0-9]/g, 'a')}`,
      courseCode: `INTE${Math.floor(Math.random() * 9000 + 1000)}`,
      displayName: 'Semester',
      status: 'draft',
      enrolmentOpenAt: undefined,
      enrolmentCloseAt: undefined,
    },
  })
  trackDoc('semesters', id)
  await transition.handle({ actor, semesterId: id, to: 'active', comment: undefined })
  return id
}

function opportunityBody(semesterId: string, overrides: Record<string, unknown> = {}) {
  return {
    semesterId,
    type: 'pre_approved',
    employerName: 'Example Pty Ltd',
    jobTitle: 'Software Intern',
    descriptionText: 'Build internal tools',
    workMode: 'hybrid',
    location: 'Melbourne',
    sourceUrl: 'https://careerhub.rmit.edu.au/jobs/123',
    ...overrides,
  }
}

async function createOpportunity(
  app: ReturnType<typeof createApp>,
  token: string,
  semesterId: string,
  overrides: Record<string, unknown> = {}
): Promise<{ id: string; etag: string }> {
  const res = await request(app)
    .post('/api/v1/opportunities')
    .set('Authorization', `Bearer ${token}`)
    .send(opportunityBody(semesterId, overrides))
  expect(res.status).toBe(201)
  trackDoc('opportunities', res.body.id)
  return { id: res.body.id, etag: res.headers['etag'] as string }
}

async function publishOpportunity(
  app: ReturnType<typeof createApp>,
  token: string,
  id: string
): Promise<void> {
  const res = await request(app)
    .post(`/api/v1/opportunities/${id}/transitions`)
    .set('Authorization', `Bearer ${token}`)
    .send({ to: 'published' })
  expect(res.status).toBe(201)
}

describe('/api/v1/opportunities — component', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
    await clearAuthUsers()
  })

  it('coordinator POST type=pre_approved with valid Career Hub URL → 201 status=draft', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const semesterId = await createActiveSemester()

    const res = await request(app)
      .post('/api/v1/opportunities')
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send(opportunityBody(semesterId))

    expect(res.status).toBe(201)
    trackDoc('opportunities', res.body.id)
    expect(res.headers['location']).toBe(`/api/v1/opportunities/${res.body.id}`)
    expect(res.headers['etag']).toBe('W/"1"')
    expect(res.body.status).toBe('draft')
    expect(res.body.type).toBe('pre_approved')
    expect(res.body.createdByUserId).toBe(coordinator.platformUserId)
  })

  it('coordinator POST type=pre_approved with non-allowlist URL → 422 url_not_on_allowlist', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const semesterId = await createActiveSemester()

    const res = await request(app)
      .post('/api/v1/opportunities')
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send(opportunityBody(semesterId, { sourceUrl: 'https://example.com/jobs/123' }))

    expect(res.status).toBe(422)
    expect(res.body.error.reason).toBe('url_not_on_allowlist')
  })

  it('student POST → 201 status=pending_verification and type=custom regardless of body', async () => {
    const app = createApp()
    const semesterId = await createActiveSemester()
    const student = await makeStudent(semesterId)

    const res = await request(app)
      .post('/api/v1/opportunities')
      .set('Authorization', `Bearer ${student.idToken}`)
      .send(opportunityBody('sem_forged', { type: 'pre_approved' }))

    expect(res.status).toBe(201)
    trackDoc('opportunities', res.body.id)
    expect(res.body.semesterId).toBe(semesterId)
    expect(res.body.status).toBe('pending_verification')
    expect(res.body.type).toBe('custom')
    expect(res.body.submittedByUserId).toBe(student.platformUserId)
  })

  it('student POST without a selected semester → 409 student_has_no_selected_semester', async () => {
    const app = createApp()
    const semesterId = await createActiveSemester()
    const student = await makeStudent()

    const res = await request(app)
      .post('/api/v1/opportunities')
      .set('Authorization', `Bearer ${student.idToken}`)
      .send(opportunityBody(semesterId, { type: 'custom', sourceUrl: 'https://seek.com.au/job/1' }))

    expect(res.status).toBe(409)
    expect(res.body.error.reason).toBe('student_has_no_selected_semester')
  })

  it('POST body containing status → 400 immutable_field', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const semesterId = await createActiveSemester()

    const res = await request(app)
      .post('/api/v1/opportunities')
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send(opportunityBody(semesterId, { status: 'published' }))

    expect(res.status).toBe(400)
    expect(res.body.error.reason).toBe('immutable_field')
  })

  it('GET list by student shows only published opportunities in their semester and cannot widen with status', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const semA = await createActiveSemester()
    const semB = await createActiveSemester()
    const student = await makeStudent(semA)
    const visible = await createOpportunity(app, coordinator.idToken, semA)
    await publishOpportunity(app, coordinator.idToken, visible.id)
    await createOpportunity(app, coordinator.idToken, semA)
    const otherSemester = await createOpportunity(app, coordinator.idToken, semB)
    await publishOpportunity(app, coordinator.idToken, otherSemester.id)

    const res = await request(app)
      .get('/api/v1/opportunities?status=draft')
      .set('Authorization', `Bearer ${student.idToken}`)

    expect(res.status).toBe(200)
    expect(res.body.items.map((i: { id: string }) => i.id)).toEqual([visible.id])
    expect(res.body.items[0].status).toBe('published')
    expect(res.body.items[0].semesterId).toBe(semA)
  })

  it('GET list by coordinator honours status, type, and semesterId filters', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const semA = await createActiveSemester()
    const semB = await createActiveSemester()
    const target = await createOpportunity(app, coordinator.idToken, semA, {
      type: 'custom',
      sourceUrl: 'https://seek.com.au/job/1',
    })
    await publishOpportunity(app, coordinator.idToken, target.id)
    await createOpportunity(app, coordinator.idToken, semA)
    const other = await createOpportunity(app, coordinator.idToken, semB, {
      type: 'custom',
      sourceUrl: 'https://seek.com.au/job/2',
    })
    await publishOpportunity(app, coordinator.idToken, other.id)

    const res = await request(app)
      .get(`/api/v1/opportunities?semesterId=${semA}&status=published&type=custom`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)

    expect(res.status).toBe(200)
    expect(res.body.items.map((i: { id: string }) => i.id)).toEqual([target.id])
  })

  it('GET /:id by student for unpublished or other-semester opportunity → 403', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const semA = await createActiveSemester()
    const semB = await createActiveSemester()
    const student = await makeStudent(semA)
    const draft = await createOpportunity(app, coordinator.idToken, semA)
    const other = await createOpportunity(app, coordinator.idToken, semB)
    await publishOpportunity(app, coordinator.idToken, other.id)

    const unpublished = await request(app)
      .get(`/api/v1/opportunities/${draft.id}`)
      .set('Authorization', `Bearer ${student.idToken}`)
    const otherSemester = await request(app)
      .get(`/api/v1/opportunities/${other.id}`)
      .set('Authorization', `Bearer ${student.idToken}`)

    expect(unpublished.status).toBe(403)
    expect(otherSemester.status).toBe(403)
  })

  it('PATCH /:id by coordinator → 200 editable fields only', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const semesterId = await createActiveSemester()
    const { id } = await createOpportunity(app, coordinator.idToken, semesterId)

    const res = await request(app)
      .patch(`/api/v1/opportunities/${id}`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send({ employerName: 'Renamed Pty Ltd', workMode: 'remote', location: null })

    expect(res.status).toBe(200)
    expect(res.body.employerName).toBe('Renamed Pty Ltd')
    expect(res.body.workMode).toBe('remote')
    expect(res.body.location).toBeNull()
    expect(res.headers['etag']).toBe('W/"2"')
  })

  it('PATCH /:id attempting to write status/semesterId/type → 400 immutable_field', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const semesterId = await createActiveSemester()
    const { id } = await createOpportunity(app, coordinator.idToken, semesterId)

    const res = await request(app)
      .patch(`/api/v1/opportunities/${id}`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send({ status: 'published', semesterId: 'sem_other', type: 'custom' })

    expect(res.status).toBe(400)
    expect(res.body.error.reason).toBe('immutable_field')
  })

  it('POST /:id/transitions coordinator draft → published → 201 and activity record written', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const semesterId = await createActiveSemester()
    const { id } = await createOpportunity(app, coordinator.idToken, semesterId)

    const res = await request(app)
      .post(`/api/v1/opportunities/${id}/transitions`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send({ to: 'published', comment: 'ready' })

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('published')
    const activity = await adminDb.collection('opportunities').doc(id).collection('activity').get()
    expect(activity.size).toBe(1)
    expect(activity.docs[0]!.data()['actorUserId']).toBe(coordinator.platformUserId)
  })

  it('POST /:id/transitions pending_verification → anything → 409 invalid_state_transition', async () => {
    const app = createApp()
    const semesterId = await createActiveSemester()
    const coordinator = await makeCoordinator()
    const student = await makeStudent(semesterId)
    const pending = await createOpportunity(app, student.idToken, semesterId, {
      type: 'pre_approved',
    })

    const res = await request(app)
      .post(`/api/v1/opportunities/${pending.id}/transitions`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send({ to: 'published' })

    expect(res.status).toBe(409)
    expect(res.body.error.reason).toBe('invalid_state_transition')
  })

  it('POST /:id/verifications approved → 201 published, verifier set, submitter notification created', async () => {
    const app = createApp()
    const semesterId = await createActiveSemester()
    const coordinator = await makeCoordinator()
    const student = await makeStudent(semesterId)
    const pending = await createOpportunity(app, student.idToken, semesterId, {
      type: 'pre_approved',
    })

    const res = await request(app)
      .post(`/api/v1/opportunities/${pending.id}/verifications`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send({ decision: 'approved' })

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('published')
    expect(res.body.verifiedByUserId).toBe(coordinator.platformUserId)
    expect(res.body.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    const notifications = await adminDb
      .collection('notifications')
      .where('relatedOpportunityId', '==', pending.id)
      .get()
    expect(notifications.size).toBe(1)
    expect(notifications.docs[0]!.data()['userId']).toBe(student.platformUserId)
  })

  it('POST /:id/verifications rejected without comment → 422 comment_required_for_decision', async () => {
    const app = createApp()
    const semesterId = await createActiveSemester()
    const coordinator = await makeCoordinator()
    const student = await makeStudent(semesterId)
    const pending = await createOpportunity(app, student.idToken, semesterId)

    const res = await request(app)
      .post(`/api/v1/opportunities/${pending.id}/verifications`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send({ decision: 'rejected' })

    expect(res.status).toBe(422)
    expect(res.body.error.reason).toBe('comment_required_for_decision')
  })

  it('POST /:id/verifications on non-pending state → 409 invalid_state_transition', async () => {
    const app = createApp()
    const semesterId = await createActiveSemester()
    const coordinator = await makeCoordinator()
    const draft = await createOpportunity(app, coordinator.idToken, semesterId)

    const res = await request(app)
      .post(`/api/v1/opportunities/${draft.id}/verifications`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send({ decision: 'approved' })

    expect(res.status).toBe(409)
    expect(res.body.error.reason).toBe('invalid_state_transition')
  })

  it('student passing another semesterId query param → 400 invalid_query', async () => {
    const app = createApp()
    const semA = await createActiveSemester()
    const semB = await createActiveSemester()
    const student = await makeStudent(semA)

    const res = await request(app)
      .get(`/api/v1/opportunities?semesterId=${semB}`)
      .set('Authorization', `Bearer ${student.idToken}`)

    expect(res.status).toBe(400)
    expect(res.body.error.reason).toBe('invalid_query')
  })

  it('applicationCount computed correctly on list response for coordinators', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()
    const semesterId = await createActiveSemester()
    const { id } = await createOpportunity(app, coordinator.idToken, semesterId)
    const appA = `int_${randomUUID()}`
    const appB = `int_${randomUUID()}`
    await Promise.all([
      adminDb.collection('internships').doc(appA).set({ opportunityId: id }),
      adminDb.collection('internships').doc(appB).set({ opportunityId: id }),
    ])
    trackDoc('internships', appA)
    trackDoc('internships', appB)

    const res = await request(app)
      .get(`/api/v1/opportunities?semesterId=${semesterId}`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)

    expect(res.status).toBe(200)
    const item = res.body.items.find((i: { id: string }) => i.id === id)
    expect(item.applicationCount).toBe(2)
  })

  it('transition + verification cannot both succeed if fired concurrently on the same doc', async () => {
    const app = createApp()
    const semesterId = await createActiveSemester()
    const coordinator = await makeCoordinator()
    const student = await makeStudent(semesterId)
    const pending = await createOpportunity(app, student.idToken, semesterId)

    const settled = await Promise.all([
      request(app)
        .post(`/api/v1/opportunities/${pending.id}/transitions`)
        .set('Authorization', `Bearer ${coordinator.idToken}`)
        .send({ to: 'published' }),
      request(app)
        .post(`/api/v1/opportunities/${pending.id}/verifications`)
        .set('Authorization', `Bearer ${coordinator.idToken}`)
        .send({ decision: 'approved' }),
    ])

    const successes = settled.filter((r) => r.status === 201)
    const conflicts = settled.filter((r) => r.status === 409)
    expect(successes.length).toBe(1)
    expect(conflicts.length).toBe(1)
  })
})
