# Firestore Schema

## Overview

Backend-owned collections are written through the API / Admin SDK. The canonical
schema is also reflected in `docs/WORKFLOW-API-SPEC.md` §8.

## Schema versioning

Every document in every collection **must** include a `_schemaVersion` field:

```typescript
_schemaVersion: 1; // increment when doing a breaking schema change
```

This enables **lazy migration** — when a document is read, check `_schemaVersion` and migrate on the fly if it's behind current. See the `/evolve-schema` skill for the full migration workflow.

**Rules:**

- `_schemaVersion` is always `1` on creation
- Non-breaking changes (adding optional fields with defaults) keep the same version
- Breaking changes (rename, remove, type change) increment the version and require a migration function
- Never remove `_schemaVersion` from a schema

---

## `users` Collection

**Path:** `/users/{userId}`
**Document ID:** Firestore auto-generated app-user ID. Do not duplicate `id` inside the document body.
**Access:** Backend-owned.

| Field             | Type                                      | Required | Description                                                                |
| ----------------- | ----------------------------------------- | -------- | -------------------------------------------------------------------------- |
| `email`           | `string`                                  | Yes      | Email synced from the IdP token                                            |
| `displayName`     | `string`                                  | No       | Display name copied from the IdP token at JIT bootstrap, mutable via PATCH |
| `role`            | `'student' \| 'coordinator'`              | Yes      | App role                                                                   |
| `status`          | `'active' \| 'inactive' \| 'blocked'`     | Yes      | Account lifecycle                                                          |
| `onboardingStage` | `'profile_pending' \| 'profile_complete'` | Yes      | Derived workflow readiness                                                 |
| `studentProfile`  | `map`                                     | No       | Present for students only                                                  |
| `createdAt`       | `Timestamp`                               | Yes      | Server creation time                                                       |
| `updatedAt`       | `Timestamp`                               | Yes      | Server update time                                                         |
| `_schemaVersion`  | `1`                                       | Yes      | Schema version                                                             |

## `userIdentities` Collection

**Path:** `/userIdentities/{provider}__{providerUserId}`
**Document ID:** Deterministic provider key, currently `firebase__{encodeURIComponent(firebaseUid)}`.
**Access:** Backend-owned.

| Field            | Type         | Required | Description                                  |
| ---------------- | ------------ | -------- | -------------------------------------------- |
| `provider`       | `'firebase'` | Yes      | Identity provider namespace                  |
| `providerUserId` | `string`     | Yes      | Provider subject / Firebase UID              |
| `userId`         | `string`     | Yes      | App user ID pointing to `users/{userId}`     |
| `emailSnapshot`  | `string`     | No       | Non-authoritative email at provisioning time |
| `createdAt`      | `Timestamp`  | Yes      | Server creation time                         |
| `_schemaVersion` | `1`          | Yes      | Schema version                               |

`userIdentities` is the uniqueness rule for IdP users. JIT provisioning creates `users/{userId}` and the matching identity document in one transaction.

## `internships` Collection

**Path:** `/internships/{internshipId}`
**Document ID:** Firestore auto-generated application ID. Do not duplicate `id` inside the document body.
**Access:** Backend-owned.

| Field                 | Type                                                                                                 | Required | Description                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------- |
| `userId`              | `string`                                                                                             | Yes      | Student owner; foreign key to `users/{userId}`           |
| `opportunityId`       | `string`                                                                                             | Yes      | Applied opportunity; foreign key to `opportunities/{id}` |
| `offerDate`           | `Timestamp`                                                                                          | No       | Offer date once the student has offer details            |
| `startDate`           | `Timestamp`                                                                                          | No       | Internship start date                                    |
| `endDate`             | `Timestamp`                                                                                          | No       | Internship end date                                      |
| `status`              | `'applied' \| 'offer_pending_review' \| 'offer_changes_requested' \| 'offer_approved' \| 'rejected'` | Yes      | Student offer workflow state                             |
| `version`             | `number`                                                                                             | Yes      | Optimistic-concurrency token exposed via `ETag`          |
| `coordinatorDecision` | `'approved' \| 'rejected' \| 'changes_requested'`                                                    | No       | Latest coordinator decision, populated by Phase 6        |
| `coordinatorComment`  | `string`                                                                                             | No       | Latest coordinator feedback, populated by Phase 6        |
| `reviewedByUserId`    | `string`                                                                                             | No       | Coordinator reviewer, populated by Phase 6               |
| `reviewedAt`          | `Timestamp`                                                                                          | No       | Latest review timestamp, populated by Phase 6            |
| `lastSubmittedAt`     | `Timestamp`                                                                                          | No       | Most recent offer-submission timestamp                   |
| `createdAt`           | `Timestamp`                                                                                          | Yes      | Server creation time                                     |
| `updatedAt`           | `Timestamp`                                                                                          | Yes      | Server update time                                       |
| `_schemaVersion`      | `1`                                                                                                  | Yes      | Schema version                                           |

### Internship Subcollections

`/internships/{internshipId}/attachments/{attachmentId}` stores synced offer-document metadata:

| Field            | Type        | Required | Description                 |
| ---------------- | ----------- | -------- | --------------------------- |
| `filePath`       | `string`    | Yes      | Cloud Storage object path   |
| `fileName`       | `string`    | No       | Display filename            |
| `contentType`    | `string`    | No       | MIME type                   |
| `uploadedAt`     | `Timestamp` | Yes      | Upload/sync timestamp       |
| `_schemaVersion` | `1`         | No       | Schema version when written |

`/internships/{internshipId}/activity/{activityId}` stores timeline events:

| Field            | Type                                                                                                   | Required    | Description                              |
| ---------------- | ------------------------------------------------------------------------------------------------------ | ----------- | ---------------------------------------- |
| `type`           | `'apply' \| 'submit_offer' \| 'comment' \| 'approve_offer' \| 'request_changes' \| 'reject' \| 'edit'` | Yes         | Activity kind                            |
| `authorUserId`   | `string`                                                                                               | Yes         | Actor user id                            |
| `authorRole`     | `'student' \| 'coordinator'`                                                                           | Yes         | Actor role at write time                 |
| `text`           | `string`                                                                                               | Conditional | Required for comment/request/reject text |
| `createdAt`      | `Timestamp`                                                                                            | Yes         | Server creation time                     |
| `_schemaVersion` | `1`                                                                                                    | Yes         | Schema version                           |

## `internshipApplications` Collection

**Path:** `/internshipApplications/{encodeURIComponent(userId)}__{encodeURIComponent(opportunityId)}`

Deterministic uniqueness sentinel for `POST /api/v1/internships`. It prevents a student from creating duplicate applications for the same opportunity, including concurrent retries.

| Field            | Type        | Required | Description           |
| ---------------- | ----------- | -------- | --------------------- |
| `internshipId`   | `string`    | Yes      | Created internship id |
| `userId`         | `string`    | Yes      | Student owner         |
| `opportunityId`  | `string`    | Yes      | Applied opportunity   |
| `createdAt`      | `Timestamp` | Yes      | Server creation time  |
| `_schemaVersion` | `1`         | Yes      | Schema version        |
