import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { CreateSemesterCommandHandler } from '../../../../src/application/commands/create-semester'
import { TransitionSemesterCommandHandler } from '../../../../src/application/commands/transition-semester'
import { CreateOpportunityCommandHandler } from '../../../../src/application/commands/create-opportunity'
import { TransitionOpportunityCommandHandler } from '../../../../src/application/commands/transition-opportunity'
import { VerifyOpportunityCommandHandler } from '../../../../src/application/commands/verify-opportunity'
import { ListOpportunitiesQueryHandler } from '../../../../src/application/queries/list-opportunities'
import { FirestoreUnitOfWork } from '../../../../src/infrastructure/firestore/firestore-unit-of-work'
import { firestoreIdGenerator } from '../../../../src/infrastructure/firestore/firestore-id-generator'
import { firestoreOpportunityQueryService } from '../../../../src/infrastructure/firestore/firestore-opportunity-query-service'
import { firestoreUserQueryService } from '../../../../src/infrastructure/firestore/firestore-user-query-service'
import { defaultAuthorizationService } from '../../../../src/infrastructure/authorization/default-authorization-service'
import { adminDb } from '../../../../src/infrastructure/config/firebase-admin'
import { User } from '../../../../src/domain/entities/user'
import { UserIdentity } from '../../../../src/domain/value-objects/user-identity'
import { StudentProfile } from '../../../../src/domain/value-objects/student-profile'
import { initEmulator, clearDocs, trackDoc } from '../../../setup.emulator'
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
  await transition.handle({ actor, semesterId: id, to: 'enrollment_open', comment: undefined })
  return id
}

async function seedStudent(studentId: string, semesterId: string | undefined): Promise<void> {
  const now = new Date()
  const providerUserId = `fb_${randomUUID()}`
  await new FirestoreUnitOfWork().execute(async (ctx) => {
    await ctx.users.save(
      User.create({
        id: studentId,
        version: 0,
        email: `${studentId}@student.rmit.edu.au`,
        role: 'student',
        status: 'active',
        onboardingStage: 'profile_complete',
        identity: UserIdentity.create({
          provider: 'firebase',
          providerUserId,
          emailSnapshot: `${studentId}@student.rmit.edu.au`,
        }),
        createdAt: now,
        updatedAt: now,
        displayName: undefined,
        studentProfile: StudentProfile.rehydrate({
          studentNumber: studentId,
          profileStatus: 'complete',
          programCode: 'BP096',
          phone: undefined,
          academicInfo: undefined,
          semesterId,
          semesterSelectedAt: semesterId ? now : undefined,
        }),
      })
    )
  })
  trackDoc('users', studentId)
}

const basePayload = {
  semesterId: undefined,
  type: 'pre_approved' as const,
  employerName: 'Example Pty Ltd',
  jobTitle: 'Software Intern',
  descriptionText: 'Build software',
  workMode: undefined,
  location: undefined,
  sourceUrl: 'https://careerhub.rmit.edu.au/jobs/123',
}

describe('Opportunities commands — integration', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
  })

  it('coordinator creates a draft opportunity document', async () => {
    const semesterId = await activeSemester()
    const handler = new CreateOpportunityCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService,
      firestoreIdGenerator
    )

    const { id } = await handler.handle({
      actor: actorFor('coordinator', 'usr_coord'),
      payload: { ...basePayload, semesterId },
    })
    trackDoc('opportunities', id)

    const snap = await adminDb.collection('opportunities').doc(id).get()
    expect(snap.exists).toBe(true)
    expect(snap.data()?.['status']).toBe('draft')
    expect(snap.data()?.['createdByUserId']).toBe('usr_coord')
  })

  it('student without selected semester gets student_has_no_selected_semester', async () => {
    await seedStudent('usr_student_no_sem', undefined)
    const handler = new CreateOpportunityCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService,
      firestoreIdGenerator
    )

    await expect(
      handler.handle({
        actor: actorFor('student', 'usr_student_no_sem'),
        payload: basePayload,
      })
    ).rejects.toMatchObject({ reason: 'student_has_no_selected_semester' })
  })

  it('draft → published updates parent and writes activity atomically', async () => {
    const semesterId = await activeSemester()
    const create = new CreateOpportunityCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService,
      firestoreIdGenerator
    )
    const actor = actorFor('coordinator', 'usr_coord')
    const { id } = await create.handle({ actor, payload: { ...basePayload, semesterId } })
    trackDoc('opportunities', id)

    await new TransitionOpportunityCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService
    ).handle({
      actor,
      opportunityId: id,
      to: 'published',
      comment: 'ready',
    })

    const [snap, activity] = await Promise.all([
      adminDb.collection('opportunities').doc(id).get(),
      adminDb.collection('opportunities').doc(id).collection('activity').get(),
    ])
    expect(snap.data()?.['status']).toBe('published')
    expect(activity.size).toBe(1)
    expect(activity.docs[0]!.data()['from']).toBe('draft')
  })

  it('approved verification publishes opportunity and creates submitter notification', async () => {
    const semesterId = await activeSemester()
    await seedStudent('usr_submitter', semesterId)
    const create = new CreateOpportunityCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService,
      firestoreIdGenerator
    )
    const { id } = await create.handle({
      actor: actorFor('student', 'usr_submitter'),
      payload: { ...basePayload, type: 'pre_approved', semesterId: 'sem_other' },
    })
    trackDoc('opportunities', id)

    await new VerifyOpportunityCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService,
      firestoreIdGenerator
    ).handle({
      actor: actorFor('coordinator', 'usr_coord'),
      opportunityId: id,
      decision: 'approved',
      comment: undefined,
    })

    const [opportunity, notifications] = await Promise.all([
      adminDb.collection('opportunities').doc(id).get(),
      adminDb.collection('notifications').where('relatedOpportunityId', '==', id).get(),
    ])
    expect(opportunity.data()?.['status']).toBe('published')
    expect(opportunity.data()?.['verifiedByUserId']).toBe('usr_coord')
    expect(notifications.size).toBe(1)
    expect(notifications.docs[0]!.data()['userId']).toBe('usr_submitter')
  })

  it('list query returns coordinator applicationCount', async () => {
    const semesterId = await activeSemester()
    const actor = actorFor('coordinator', 'usr_coord')
    const create = new CreateOpportunityCommandHandler(
      new FirestoreUnitOfWork(),
      defaultAuthorizationService,
      firestoreIdGenerator
    )
    const { id } = await create.handle({ actor, payload: { ...basePayload, semesterId } })
    trackDoc('opportunities', id)
    const appA = `int_${randomUUID()}`
    const appB = `int_${randomUUID()}`
    await Promise.all([
      adminDb.collection('internships').doc(appA).set({ opportunityId: id }),
      adminDb.collection('internships').doc(appB).set({ opportunityId: id }),
    ])
    trackDoc('internships', appA)
    trackDoc('internships', appB)

    const result = await new ListOpportunitiesQueryHandler(
      firestoreOpportunityQueryService,
      firestoreUserQueryService,
      defaultAuthorizationService
    ).handle({
      actor,
      filter: {
        semesterId,
        status: ['draft'],
        type: 'pre_approved',
        limit: 50,
        sortField: 'createdAt',
        sortDirection: 'desc',
        cursor: undefined,
      },
    })

    const item = result.items.find((i) => i.opportunity.id === id)
    expect(item?.applicationCount).toBe(2)
  })
})
