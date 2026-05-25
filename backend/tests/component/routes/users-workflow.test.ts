/**
 * Component — `/api/v1/users/:id/semester-selection` and
 * `/api/v1/users/:id/workflow` (Phase 3).
 *
 * One `it(...)` per bullet in Phase 3's Success criteria + Bug-finding cases
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
import { adminAuth, adminDb, Timestamp } from '../../../src/infrastructure/config/firebase-admin'
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

function uniqueSemesterCode(): string {
  return `2026-S${randomUUID()
    .slice(0, 8)
    .replace(/[^A-Za-z0-9]/g, 'a')}`
}

function uniqueCourseCode(): string {
  return `INTE${Math.floor(Math.random() * 9000 + 1000)}`
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

async function completeStudentProfile(
  app: ReturnType<typeof createApp>,
  student: { idToken: string }
): Promise<void> {
  const res = await request(app)
    .patch('/api/v1/users/me')
    .set('Authorization', `Bearer ${student.idToken}`)
    .send(completePatch)
  expect(res.status).toBe(200)
}

interface SemesterOpts {
  transitionTo?: 'enrollment_open' | 'placement_running' | 'archived'
}

async function createSemester(
  app: ReturnType<typeof createApp>,
  coordinator: { idToken: string },
  opts: SemesterOpts = { transitionTo: 'enrollment_open' }
): Promise<{ id: string }> {
  const create = await request(app)
    .post('/api/v1/semesters')
    .set('Authorization', `Bearer ${coordinator.idToken}`)
    .send({
      semesterCode: uniqueSemesterCode(),
      courseCode: uniqueCourseCode(),
      displayName: 'Sem',
      status: 'draft',
    })
  expect(create.status).toBe(201)
  trackDoc('semesters', create.body.id)
  const semesterId = create.body.id as string

  if (opts.transitionTo === 'enrollment_open' || opts.transitionTo === 'placement_running') {
    const t1 = await request(app)
      .post(`/api/v1/semesters/${semesterId}/transitions`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send({ to: 'enrollment_open' })
    expect(t1.status).toBe(201)
  }
  if (opts.transitionTo === 'placement_running') {
    const t2 = await request(app)
      .post(`/api/v1/semesters/${semesterId}/transitions`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send({ to: 'placement_running' })
    expect(t2.status).toBe(201)
  }
  if (opts.transitionTo === 'archived') {
    const t1 = await request(app)
      .post(`/api/v1/semesters/${semesterId}/transitions`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send({ to: 'archived' })
    expect(t1.status).toBe(201)
  }
  return { id: semesterId }
}

describe('PUT /api/v1/users/:id/semester-selection — component', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
    await clearAuthUsers()
  })

  it('incomplete profile → 409 profile_incomplete', async () => {
    const app = createApp()
    const student = await syncStudent(app)
    const coordinator = await makeCoordinator()
    const semester = await createSemester(app, coordinator)

    const res = await request(app)
      .put(`/api/v1/users/${student.id}/semester-selection`)
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({ semesterId: semester.id })

    expect(res.status).toBe(409)
    expect(res.body.error.reason).toBe('profile_incomplete')
  })

  it('non-active semester → 409 semester_not_active', async () => {
    const app = createApp()
    const student = await syncStudent(app)
    await completeStudentProfile(app, student)
    const coordinator = await makeCoordinator()
    // Skip the transition — semester stays draft.
    const semester = await createSemester(app, coordinator, { transitionTo: undefined })

    const res = await request(app)
      .put(`/api/v1/users/${student.id}/semester-selection`)
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({ semesterId: semester.id })

    expect(res.status).toBe(409)
    expect(res.body.error.reason).toBe('semester_not_active')
  })

  it('placement_running semester → 409 semester_not_active', async () => {
    const app = createApp()
    const student = await syncStudent(app)
    await completeStudentProfile(app, student)
    const coordinator = await makeCoordinator()
    // Enrollment closed once coordinator transitions to placement_running.
    const semester = await createSemester(app, coordinator, { transitionTo: 'placement_running' })

    const res = await request(app)
      .put(`/api/v1/users/${student.id}/semester-selection`)
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({ semesterId: semester.id })

    expect(res.status).toBe(409)
    expect(res.body.error.reason).toBe('semester_not_active')
  })

  it('first success sets semesterSelectedAt; subsequent PUTs leave it unchanged', async () => {
    const app = createApp()
    const student = await syncStudent(app)
    await completeStudentProfile(app, student)
    const coordinator = await makeCoordinator()
    const a = await createSemester(app, coordinator)
    const b = await createSemester(app, coordinator)

    const first = await request(app)
      .put(`/api/v1/users/${student.id}/semester-selection`)
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({ semesterId: a.id })
    expect(first.status).toBe(200)
    const firstSelectedAt = first.body.studentProfile.semesterSelectedAt as string
    expect(firstSelectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    await new Promise((r) => setTimeout(r, 10))

    const second = await request(app)
      .put(`/api/v1/users/${student.id}/semester-selection`)
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({ semesterId: b.id })
    expect(second.status).toBe(200)
    expect(second.body.studentProfile.semesterId).toBe(b.id)
    expect(second.body.studentProfile.semesterSelectedAt).toBe(firstSelectedAt)
  })

  it('PUT /users/me/semester-selection alias works', async () => {
    const app = createApp()
    const student = await syncStudent(app)
    await completeStudentProfile(app, student)
    const coordinator = await makeCoordinator()
    const semester = await createSemester(app, coordinator)

    const res = await request(app)
      .put('/api/v1/users/me/semester-selection')
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({ semesterId: semester.id })

    expect(res.status).toBe(200)
    expect(res.body.studentProfile.semesterId).toBe(semester.id)
  })

  it('non-owner student → 403 student_not_owner', async () => {
    const app = createApp()
    const owner = await syncStudent(app)
    const other = await syncStudent(app)
    await completeStudentProfile(app, other)
    const coordinator = await makeCoordinator()
    const semester = await createSemester(app, coordinator)

    const res = await request(app)
      .put(`/api/v1/users/${owner.id}/semester-selection`)
      .set('Authorization', `Bearer ${other.idToken}`)
      .send({ semesterId: semester.id })

    expect(res.status).toBe(403)
    expect(res.body.error.reason).toBe('student_not_owner')
  })

  // Removed: the original "coordinator user id → 404" test relied on
  // forging Firebase custom claims to make a fabricated student token
  // resolve to the coordinator's `platformUserId`, bypassing the owner
  // check. Pattern B reads identity from Firestore (`userIdentities` →
  // `users/{id}`), not from claims, so that bypass no longer exists —
  // a non-owner student targeting any other id produces 403
  // `student_not_owner` (already covered above). The 404 branch
  // (coordinator target on a student-only sub-resource) is exercised by
  // the workflow test below.
})

describe('GET /api/v1/users/:id/workflow — component', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
    await clearAuthUsers()
  })

  it('returns currentWorkflowStep / internshipStatus / semesterEnrolmentState per §7.1/§9.2 tables', async () => {
    const app = createApp()
    const student = await syncStudent(app)
    await completeStudentProfile(app, student)
    const coordinator = await makeCoordinator()
    const semester = await createSemester(app, coordinator)
    const select = await request(app)
      .put('/api/v1/users/me/semester-selection')
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({ semesterId: semester.id })
    expect(select.status).toBe(200)

    const res = await request(app)
      .get(`/api/v1/users/${student.id}/workflow`)
      .set('Authorization', `Bearer ${student.idToken}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      currentWorkflowStep: 'opportunity_browsing',
      internshipStatus: 'browsing_opportunities',
      semesterEnrolmentState: 'enrolled',
    })
  })

  it('workflow reflects the furthest active internship state once internships exist', async () => {
    const app = createApp()
    const student = await syncStudent(app)
    await completeStudentProfile(app, student)
    const coordinator = await makeCoordinator()
    const semester = await createSemester(app, coordinator)
    const select = await request(app)
      .put('/api/v1/users/me/semester-selection')
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({ semesterId: semester.id })
    expect(select.status).toBe(200)

    const internshipId = `int_${randomUUID()}`
    const now = Timestamp.fromDate(new Date())
    await adminDb
      .collection('internships')
      .doc(internshipId)
      .set({
        userId: student.id,
        opportunityId: `opp_${randomUUID()}`,
        status: 'offer_pending_review',
        version: 1,
        lastSubmittedAt: now,
        createdAt: now,
        updatedAt: now,
        _schemaVersion: 1,
      })
    trackDoc('internships', internshipId)

    const res = await request(app)
      .get(`/api/v1/users/${student.id}/workflow`)
      .set('Authorization', `Bearer ${student.idToken}`)

    expect(res.status).toBe(200)
    expect(res.body.currentWorkflowStep).toBe('offer_stage')
    expect(res.body.internshipStatus).toBe('offer_in_review')
    expect(res.body.semesterEnrolmentState).toBe('enrolled')
  })

  it('coordinator target → 404', async () => {
    const app = createApp()
    const coordinator = await makeCoordinator()

    // The `users/{id}` doc for a coordinator exists but has no student
    // sub-resource (`role !== 'student'`). The handler raises 404 after
    // the role check — the coordinator-target path matches the
    // missing-record path so callers can't enumerate roles via status.
    const res = await request(app)
      .get(`/api/v1/users/${coordinator.platformUserId}/workflow`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)

    expect(res.status).toBe(404)
  })

  it('student profile completed mid-session can immediately PUT a semester without re-authenticating', async () => {
    // Bug-finding case: token is minted *before* the profile becomes
    // complete, but the PUT still succeeds because the precondition is
    // checked server-side (against current Firestore state), not from
    // the token.
    const app = createApp()
    const student = await syncStudent(app)
    const coordinator = await makeCoordinator()
    const semester = await createSemester(app, coordinator)

    // Token captured before profile completion.
    const stableToken = student.idToken

    const complete = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${stableToken}`)
      .send(completePatch)
    expect(complete.status).toBe(200)

    const select = await request(app)
      .put('/api/v1/users/me/semester-selection')
      .set('Authorization', `Bearer ${stableToken}`)
      .send({ semesterId: semester.id })
    expect(select.status).toBe(200)
    expect(select.body.studentProfile.semesterId).toBe(semester.id)
  })

  it('semesterEnrolmentState is window_closed when coordinator transitions semester to placement_running', async () => {
    const app = createApp()
    const student = await syncStudent(app)
    await completeStudentProfile(app, student)
    const coordinator = await makeCoordinator()
    // Select an enrollment_open semester, then coordinator transitions to
    // placement_running — which closes enrollment for new students while
    // letting existing students keep their slot.
    const semester = await createSemester(app, coordinator)
    const select = await request(app)
      .put('/api/v1/users/me/semester-selection')
      .set('Authorization', `Bearer ${student.idToken}`)
      .send({ semesterId: semester.id })
    expect(select.status).toBe(200)

    // Coordinator closes enrollment via status transition.
    const transition = await request(app)
      .post(`/api/v1/semesters/${semester.id}/transitions`)
      .set('Authorization', `Bearer ${coordinator.idToken}`)
      .send({ to: 'placement_running' })
    expect(transition.status).toBe(201)

    const res = await request(app)
      .get('/api/v1/users/me/workflow')
      .set('Authorization', `Bearer ${student.idToken}`)
    expect(res.status).toBe(200)
    expect(res.body.semesterEnrolmentState).toBe('window_closed')
  })
})
