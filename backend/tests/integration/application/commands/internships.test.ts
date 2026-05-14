import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { CreateSemesterCommandHandler } from '../../../../src/application/commands/create-semester'
import { TransitionSemesterCommandHandler } from '../../../../src/application/commands/transition-semester'
import { CreateOpportunityCommandHandler } from '../../../../src/application/commands/create-opportunity'
import { TransitionOpportunityCommandHandler } from '../../../../src/application/commands/transition-opportunity'
import { CreateInternshipCommandHandler } from '../../../../src/application/commands/create-internship'
import { SubmitInternshipOfferCommandHandler } from '../../../../src/application/commands/submit-internship-offer'
import { AddInternshipCommentCommandHandler } from '../../../../src/application/commands/add-internship-comment'
import { DecideInternshipOfferCommandHandler } from '../../../../src/application/commands/decide-internship-offer'
import { FirestoreUnitOfWork } from '../../../../src/infrastructure/firestore/firestore-unit-of-work'
import { firestoreIdGenerator } from '../../../../src/infrastructure/firestore/firestore-id-generator'
import { defaultAuthorizationService } from '../../../../src/infrastructure/authorization/default-authorization-service'
import { adminDb, Timestamp } from '../../../../src/infrastructure/config/firebase-admin'
import { User } from '../../../../src/domain/entities/user'
import { UserIdentity } from '../../../../src/domain/value-objects/user-identity'
import { StudentProfile } from '../../../../src/domain/value-objects/student-profile'
import { clearDocs, initEmulator, trackDoc } from '../../../setup.emulator'
import type { RequestActor } from '../../../../src/application/actor'

function actorFor(
  role: 'student' | 'coordinator',
  id = `usr_${role}_${randomUUID()}`
): RequestActor {
  return {
    firebaseUid: `fb_${randomUUID()}`,
    email: `${randomUUID().slice(0, 6)}@rmit.edu.au`,
    platformUser: { id, role },
  }
}

async function seedUser(
  role: 'student' | 'coordinator',
  id: string,
  semesterId?: string
): Promise<void> {
  const now = new Date()
  await new FirestoreUnitOfWork().execute(async (ctx) => {
    await ctx.users.save(
      User.create({
        id,
        version: 0,
        email: `${id}@${role === 'student' ? 'student.' : ''}rmit.edu.au`,
        role,
        status: 'active',
        onboardingStage: 'profile_complete',
        identity: UserIdentity.create({
          provider: 'firebase',
          providerUserId: `fb_${randomUUID()}`,
          emailSnapshot: `${id}@rmit.edu.au`,
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
  trackDoc('users', id)
}

async function activeSemester(): Promise<string> {
  const uow = new FirestoreUnitOfWork()
  const create = new CreateSemesterCommandHandler(
    uow,
    defaultAuthorizationService,
    firestoreIdGenerator
  )
  const transition = new TransitionSemesterCommandHandler(uow, defaultAuthorizationService)
  const actor = actorFor('coordinator')
  const { id } = await create.handle({
    actor,
    payload: {
      semesterCode: `2026-S${randomUUID()
        .slice(0, 8)
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

async function publishedOpportunity(semesterId: string): Promise<string> {
  const uow = new FirestoreUnitOfWork()
  const actor = actorFor('coordinator', 'usr_coord_actor')
  const create = new CreateOpportunityCommandHandler(
    uow,
    defaultAuthorizationService,
    firestoreIdGenerator
  )
  const transition = new TransitionOpportunityCommandHandler(uow, defaultAuthorizationService)
  const { id } = await create.handle({
    actor,
    payload: {
      semesterId,
      type: 'pre_approved',
      employerName: 'Example Pty Ltd',
      jobTitle: 'Software Intern',
      descriptionText: 'Build software',
      workMode: undefined,
      location: undefined,
      sourceUrl: 'https://careerhub.rmit.edu.au/jobs/123',
    },
  })
  trackDoc('opportunities', id)
  await transition.handle({ actor, opportunityId: id, to: 'published', comment: undefined })
  return id
}

async function createAppliedInternship(studentId: string, opportunityId: string): Promise<string> {
  const { id } = await new CreateInternshipCommandHandler(
    new FirestoreUnitOfWork(),
    defaultAuthorizationService,
    firestoreIdGenerator
  ).handle({
    actor: actorFor('student', studentId),
    payload: { opportunityId },
  })
  trackDoc('internships', id)
  return id
}

async function addAttachment(internshipId: string): Promise<void> {
  await adminDb
    .collection('internships')
    .doc(internshipId)
    .collection('attachments')
    .doc(`att_${randomUUID()}`)
    .set({
      filePath: `users/usr_student/internships/${internshipId}/attachments/offer.pdf`,
      fileName: 'offer.pdf',
      contentType: 'application/pdf',
      uploadedAt: Timestamp.fromDate(new Date()),
      _schemaVersion: 1,
    })
}

async function submitForReview(studentId: string, internshipId: string): Promise<void> {
  await addAttachment(internshipId)
  await new SubmitInternshipOfferCommandHandler(
    new FirestoreUnitOfWork(),
    defaultAuthorizationService,
    firestoreIdGenerator
  ).handle({
    actor: actorFor('student', studentId),
    internshipId,
    payload: {
      offerDate: new Date('2026-05-01T00:00:00Z'),
      startDate: new Date('2026-06-01T00:00:00Z'),
      endDate: undefined,
    },
  })
}

describe('Internship commands — integration', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
  })

  it('student creates an applied internship with apply activity and coordinator notification', async () => {
    const semesterId = await activeSemester()
    const coordinatorId = `usr_coord_${randomUUID()}`
    const studentId = `usr_student_${randomUUID()}`
    await seedUser('coordinator', coordinatorId)
    await seedUser('student', studentId, semesterId)
    const opportunityId = await publishedOpportunity(semesterId)

    const internshipId = await createAppliedInternship(studentId, opportunityId)

    const [internship, activity, notifications] = await Promise.all([
      adminDb.collection('internships').doc(internshipId).get(),
      adminDb.collection('internships').doc(internshipId).collection('activity').get(),
      adminDb.collection('notifications').where('relatedInternshipId', '==', internshipId).get(),
    ])
    expect(internship.data()?.['status']).toBe('applied')
    expect(internship.data()?.['version']).toBe(1)
    expect(activity.docs.map((doc) => doc.data()['type'])).toContain('apply')
    expect(notifications.docs.some((doc) => doc.data()['userId'] === coordinatorId)).toBe(true)
  })

  it('student duplicate application for same opportunity → duplicate_application', async () => {
    const semesterId = await activeSemester()
    const studentId = `usr_student_${randomUUID()}`
    await seedUser('student', studentId, semesterId)
    const opportunityId = await publishedOpportunity(semesterId)
    await createAppliedInternship(studentId, opportunityId)

    await expect(
      new CreateInternshipCommandHandler(
        new FirestoreUnitOfWork(),
        defaultAuthorizationService,
        firestoreIdGenerator
      ).handle({
        actor: actorFor('student', studentId),
        payload: { opportunityId },
      })
    ).rejects.toMatchObject({ reason: 'duplicate_application' })
  })

  it('offer submission without attachment → offer_attachment_missing', async () => {
    const semesterId = await activeSemester()
    const studentId = `usr_student_${randomUUID()}`
    await seedUser('student', studentId, semesterId)
    const opportunityId = await publishedOpportunity(semesterId)
    const internshipId = await createAppliedInternship(studentId, opportunityId)

    await expect(
      new SubmitInternshipOfferCommandHandler(
        new FirestoreUnitOfWork(),
        defaultAuthorizationService,
        firestoreIdGenerator
      ).handle({
        actor: actorFor('student', studentId),
        internshipId,
        payload: {
          offerDate: new Date('2026-05-01T00:00:00Z'),
          startDate: new Date('2026-06-01T00:00:00Z'),
          endDate: undefined,
        },
      })
    ).rejects.toMatchObject({ reason: 'offer_attachment_missing' })
  })

  it('valid offer submission updates parent and writes submit_offer activity', async () => {
    const semesterId = await activeSemester()
    const studentId = `usr_student_${randomUUID()}`
    await seedUser('student', studentId, semesterId)
    const opportunityId = await publishedOpportunity(semesterId)
    const internshipId = await createAppliedInternship(studentId, opportunityId)
    await addAttachment(internshipId)

    await new SubmitInternshipOfferCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService,
      firestoreIdGenerator
    ).handle({
      actor: actorFor('student', studentId),
      internshipId,
      payload: {
        offerDate: new Date('2026-05-01T00:00:00Z'),
        startDate: new Date('2026-06-01T00:00:00Z'),
        endDate: undefined,
      },
    })

    const [internship, activity] = await Promise.all([
      adminDb.collection('internships').doc(internshipId).get(),
      adminDb.collection('internships').doc(internshipId).collection('activity').get(),
    ])
    expect(internship.data()?.['status']).toBe('offer_pending_review')
    expect(internship.data()?.['version']).toBe(2)
    expect(internship.data()?.['lastSubmittedAt']).toBeDefined()
    expect(activity.docs.map((doc) => doc.data()['type'])).toContain('submit_offer')
  })

  it('comments do not rotate the internship version', async () => {
    const semesterId = await activeSemester()
    const coordinatorId = `usr_coord_${randomUUID()}`
    const studentId = `usr_student_${randomUUID()}`
    await seedUser('coordinator', coordinatorId)
    await seedUser('student', studentId, semesterId)
    const opportunityId = await publishedOpportunity(semesterId)
    const internshipId = await createAppliedInternship(studentId, opportunityId)

    const before = await adminDb.collection('internships').doc(internshipId).get()
    const result = await new AddInternshipCommentCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService,
      firestoreIdGenerator
    ).handle({
      actor: actorFor('coordinator', coordinatorId),
      internshipId,
      text: 'Please upload the offer letter.',
    })
    const after = await adminDb.collection('internships').doc(internshipId).get()
    const comment = await adminDb
      .collection('internships')
      .doc(internshipId)
      .collection('activity')
      .doc(result.activity.id)
      .get()

    expect(after.data()?.['version']).toBe(before.data()?.['version'])
    expect(comment.data()?.['type']).toBe('comment')
    expect(comment.data()?.['text']).toBe('Please upload the offer letter.')
  })

  it('coordinator approved decision persists review metadata, activity, and student notification', async () => {
    const semesterId = await activeSemester()
    const coordinatorId = `usr_coord_${randomUUID()}`
    const studentId = `usr_student_${randomUUID()}`
    await seedUser('coordinator', coordinatorId)
    await seedUser('student', studentId, semesterId)
    const opportunityId = await publishedOpportunity(semesterId)
    const internshipId = await createAppliedInternship(studentId, opportunityId)
    await submitForReview(studentId, internshipId)

    await new DecideInternshipOfferCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService,
      firestoreIdGenerator
    ).handle({
      actor: actorFor('coordinator', coordinatorId),
      internshipId,
      payload: { decision: 'approved', comment: undefined },
      metadata: { expectedVersion: 2 },
    })

    const [internship, activity, notification] = await Promise.all([
      adminDb.collection('internships').doc(internshipId).get(),
      adminDb.collection('internships').doc(internshipId).collection('activity').get(),
      adminDb.collection('notifications').where('relatedInternshipId', '==', internshipId).get(),
    ])
    expect(internship.data()?.['status']).toBe('offer_approved')
    expect(internship.data()?.['version']).toBe(3)
    expect(internship.data()?.['coordinatorDecision']).toBe('approved')
    expect(internship.data()?.['reviewedByUserId']).toBe(coordinatorId)
    expect(internship.data()?.['reviewedAt']).toBeDefined()
    expect(activity.docs.map((doc) => doc.data()['type'])).toContain('approve_offer')
    expect(
      notification.docs.some(
        (doc) => doc.data()['type'] === 'offer_decision' && doc.data()['userId'] === studentId
      )
    ).toBe(true)
  })

  it('coordinator rejected decision requires a comment', async () => {
    const semesterId = await activeSemester()
    const coordinatorId = `usr_coord_${randomUUID()}`
    const studentId = `usr_student_${randomUUID()}`
    await seedUser('coordinator', coordinatorId)
    await seedUser('student', studentId, semesterId)
    const opportunityId = await publishedOpportunity(semesterId)
    const internshipId = await createAppliedInternship(studentId, opportunityId)
    await submitForReview(studentId, internshipId)

    await expect(
      new DecideInternshipOfferCommandHandler(
        new FirestoreUnitOfWork(),
        defaultAuthorizationService,
        firestoreIdGenerator
      ).handle({
        actor: actorFor('coordinator', coordinatorId),
        internshipId,
        payload: { decision: 'rejected', comment: undefined },
      })
    ).rejects.toMatchObject({ reason: 'comment_required_for_decision' })
  })

  it('student cannot decide an internship offer', async () => {
    const semesterId = await activeSemester()
    const studentId = `usr_student_${randomUUID()}`
    await seedUser('student', studentId, semesterId)
    const opportunityId = await publishedOpportunity(semesterId)
    const internshipId = await createAppliedInternship(studentId, opportunityId)
    await submitForReview(studentId, internshipId)

    await expect(
      new DecideInternshipOfferCommandHandler(
        new FirestoreUnitOfWork(),
        defaultAuthorizationService,
        firestoreIdGenerator
      ).handle({
        actor: actorFor('student', studentId),
        internshipId,
        payload: { decision: 'approved', comment: undefined },
      })
    ).rejects.toMatchObject({ reason: 'role_restricted_action' })
  })
})
