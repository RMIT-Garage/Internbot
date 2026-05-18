import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { ListUserActivityQueryHandler } from '../../../../src/application/queries/list-user-activity'
import { FirestoreUnitOfWork } from '../../../../src/infrastructure/firestore/firestore-unit-of-work'
import { firestoreActivityFeedQueryService } from '../../../../src/infrastructure/firestore/firestore-activity-feed-query-service'
import { firestoreUserQueryService } from '../../../../src/infrastructure/firestore/firestore-user-query-service'
import { defaultAuthorizationService } from '../../../../src/infrastructure/authorization/default-authorization-service'
import { adminDb, Timestamp } from '../../../../src/infrastructure/config/firebase-admin'
import { User } from '../../../../src/domain/entities/user'
import { UserIdentity } from '../../../../src/domain/value-objects/user-identity'
import { clearDocs, initEmulator, trackDoc } from '../../../setup.emulator'
import type { RequestActor } from '../../../../src/application/actor'

function actorFor(role: 'student' | 'coordinator', id: string): RequestActor {
  return {
    firebaseUid: `fb_${randomUUID()}`,
    email: `${id}@rmit.edu.au`,
    platformUser: { id, role },
  }
}

async function seedUser(role: 'student' | 'coordinator', id: string): Promise<void> {
  const now = new Date()
  await new FirestoreUnitOfWork().execute(async (ctx) => {
    await ctx.users.save(
      User.create({
        id,
        version: 0,
        email: `${id}@rmit.edu.au`,
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
        studentProfile: undefined,
      })
    )
  })
  trackDoc('users', id)
}

async function seedInternshipActivity(props: {
  internshipId: string
  activityId: string
  authorUserId: string
  authorRole: 'student' | 'coordinator'
  type: 'comment' | 'submit_offer' | 'approve_offer'
  createdAt: Date
  text?: string
}): Promise<void> {
  trackDoc('internships', props.internshipId)
  await adminDb
    .collection('internships')
    .doc(props.internshipId)
    .collection('activity')
    .doc(props.activityId)
    .set({
      type: props.type,
      authorUserId: props.authorUserId,
      authorRole: props.authorRole,
      ...(props.text !== undefined ? { text: props.text } : {}),
      createdAt: Timestamp.fromDate(props.createdAt),
      _schemaVersion: 1,
    })
}

async function seedOpportunityActivity(props: {
  opportunityId: string
  activityId: string
  authorUserId: string
  createdAt: Date
}): Promise<void> {
  trackDoc('opportunities', props.opportunityId)
  await adminDb
    .collection('opportunities')
    .doc(props.opportunityId)
    .collection('activity')
    .doc(props.activityId)
    .set({
      type: 'transition',
      from: 'draft',
      to: 'published',
      actorUserId: props.authorUserId,
      authorUserId: props.authorUserId,
      authorRole: 'coordinator',
      createdAt: Timestamp.fromDate(props.createdAt),
      _schemaVersion: 1,
    })
}

describe('ListUserActivityQueryHandler — integration', () => {
  beforeAll(() => initEmulator())
  afterEach(async () => {
    await clearDocs()
  })

  it('returns only caller-authored activity and derives resource ids from parent paths', async () => {
    const userId = `usr_student_${randomUUID()}`
    const otherId = `usr_student_${randomUUID()}`
    const internshipId = `int_${randomUUID()}`
    await seedUser('student', userId)
    await seedUser('student', otherId)
    await seedInternshipActivity({
      internshipId,
      activityId: `act_${randomUUID()}`,
      authorUserId: userId,
      authorRole: 'student',
      type: 'comment',
      text: 'Student comment',
      createdAt: new Date('2026-04-05T10:00:00Z'),
    })
    await seedInternshipActivity({
      internshipId: `int_${randomUUID()}`,
      activityId: `act_${randomUUID()}`,
      authorUserId: otherId,
      authorRole: 'student',
      type: 'comment',
      text: 'Other comment',
      createdAt: new Date('2026-04-05T11:00:00Z'),
    })

    const result = await new ListUserActivityQueryHandler(
      firestoreActivityFeedQueryService,
      firestoreUserQueryService,
      defaultAuthorizationService
    ).handle({
      actor: actorFor('student', userId),
      userId,
      filter: { limit: 50, sortDirection: 'desc', cursor: undefined },
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      resourceType: 'internship',
      internshipId,
      opportunityId: undefined,
      authorUserId: userId,
      text: 'Student comment',
    })
    expect(result.cursor).toBeNull()
  })

  it('paginates by createdAt and supports ascending order', async () => {
    const userId = `usr_coord_${randomUUID()}`
    await seedUser('coordinator', userId)
    await seedInternshipActivity({
      internshipId: `int_${randomUUID()}`,
      activityId: `act_${randomUUID()}`,
      authorUserId: userId,
      authorRole: 'coordinator',
      type: 'approve_offer',
      createdAt: new Date('2026-04-05T10:00:00Z'),
    })
    await seedInternshipActivity({
      internshipId: `int_${randomUUID()}`,
      activityId: `act_${randomUUID()}`,
      authorUserId: userId,
      authorRole: 'coordinator',
      type: 'comment',
      text: 'Later',
      createdAt: new Date('2026-04-05T11:00:00Z'),
    })

    const handler = new ListUserActivityQueryHandler(
      firestoreActivityFeedQueryService,
      firestoreUserQueryService,
      defaultAuthorizationService
    )
    const first = await handler.handle({
      actor: actorFor('coordinator', userId),
      userId,
      filter: { limit: 1, sortDirection: 'asc', cursor: undefined },
    })
    const second = await handler.handle({
      actor: actorFor('coordinator', userId),
      userId,
      filter: { limit: 1, sortDirection: 'asc', cursor: first.cursor ?? undefined },
    })

    expect(first.items[0]!.createdAt.toISOString()).toBe('2026-04-05T10:00:00.000Z')
    expect(first.cursor).not.toBeNull()
    expect(second.items[0]!.createdAt.toISOString()).toBe('2026-04-05T11:00:00.000Z')
    expect(second.cursor).toBeNull()
  })

  it('includes opportunity activity written with the shared authorUserId feed key', async () => {
    const userId = `usr_coord_${randomUUID()}`
    const opportunityId = `opp_${randomUUID()}`
    await seedUser('coordinator', userId)
    await seedOpportunityActivity({
      opportunityId,
      activityId: `act_${randomUUID()}`,
      authorUserId: userId,
      createdAt: new Date('2026-04-05T12:00:00Z'),
    })

    const result = await new ListUserActivityQueryHandler(
      firestoreActivityFeedQueryService,
      firestoreUserQueryService,
      defaultAuthorizationService
    ).handle({
      actor: actorFor('coordinator', userId),
      userId,
      filter: { limit: 50, sortDirection: 'desc', cursor: undefined },
    })

    expect(result.items[0]).toMatchObject({
      resourceType: 'opportunity',
      internshipId: undefined,
      opportunityId,
      type: 'transition',
      from: 'draft',
      to: 'published',
      authorUserId: userId,
    })
  })

  it('rejects another user activity feed before querying activity', async () => {
    const userId = `usr_coord_${randomUUID()}`
    const otherId = `usr_coord_${randomUUID()}`
    await seedUser('coordinator', userId)
    await seedUser('coordinator', otherId)

    await expect(
      new ListUserActivityQueryHandler(
        firestoreActivityFeedQueryService,
        firestoreUserQueryService,
        defaultAuthorizationService
      ).handle({
        actor: actorFor('coordinator', userId),
        userId: otherId,
        filter: { limit: 50, sortDirection: 'desc', cursor: undefined },
      })
    ).rejects.toMatchObject({ reason: 'user_not_owner' })
  })
})
