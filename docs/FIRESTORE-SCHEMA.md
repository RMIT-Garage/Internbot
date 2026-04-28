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

| Field             | Type                                      | Required | Description                        |
| ----------------- | ----------------------------------------- | -------- | ---------------------------------- |
| `email`           | `string`                                  | Yes      | Email synced from the IdP token    |
| `displayName`     | `string`                                  | No       | Display name synced from auth/sync |
| `role`            | `'student' \| 'coordinator'`              | Yes      | App role                           |
| `status`          | `'active' \| 'inactive' \| 'blocked'`     | Yes      | Account lifecycle                  |
| `onboardingStage` | `'profile_pending' \| 'profile_complete'` | Yes      | Derived workflow readiness         |
| `studentProfile`  | `map`                                     | No       | Present for students only          |
| `createdAt`       | `Timestamp`                               | Yes      | Server creation time               |
| `updatedAt`       | `Timestamp`                               | Yes      | Server update time                 |
| `_schemaVersion`  | `1`                                       | Yes      | Schema version                     |

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
