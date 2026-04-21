# Workflow API — Implementation Plan

Implementation roadmap for [WORKFLOW-API-SPEC.md](./WORKFLOW-API-SPEC.md).

- **Cadence:** one PR per phase, merged to `develop` behind feature branches per [GIT-WORKFLOW.md](./GIT-WORKFLOW.md).
- **Out of scope (v1):** AI endpoints (`/ai-reviews`, `/faq`) and email delivery on notifications. Structural hooks remain so both can be added later without migrations.
- **Global definition of done (every phase):** `pnpm run typecheck` + `pnpm run lint` + `pnpm run test` pass; integration tests for Firestore queries pass; no new `eslint-disable` comments; docs updated for any deviation from the spec.

## How to edit this file

This is a sprint-contract file, not a status log. Two rules:

1. **Agents (Claude) may only change:** the `Status` line, the `PR` line, and append a terse `Notes` line per phase. **Never** rewrite `Scope`, `Success criteria`, or `Bug-finding cases` without human confirmation — those are negotiated up front and frozen for the duration of the phase.
2. If a phase's scope genuinely needs to change mid-flight, stop, ask, amend this file in a separate commit, then resume.

## Phase dependency graph

```
1 Identity ── 2 Semesters ── 3 Enrolment ── 4 Opportunities ── 5 Internships ── 6 Decisions
                                                                                    │
                                            ┌───────────────────────────────────────┤
                                            ▼                                       ▼
                                      7 Activity feed                         8 Notifications
                                                                                    │
                                            ┌───────────────────────────────────────┤
                                            ▼                                       ▼
                                         9 Tickets                           10 Attachments
```

---

## Phase 1 — Identity + shared foundations

**Status:** pending
**PR:** —

### Scope

- Shared foundations bundled into this phase (every later phase depends on them):
  - Platform-id resolver: auth middleware looks up `users where firebaseUid == token.uid` and populates `actor.{id, role, studentProfile?}`.
  - ETag helper (derived from Firestore `updateTime`) + `If-Match` middleware → 412 on mismatch.
  - Cursor pagination helper (opaque token = last doc snapshot reference).
  - Role guards: `requireCoordinator()`, `requireStudent()`, `requireOwner(resourceUserId)`.
  - `me` alias resolver for user-addressed URLs.
  - Error wrapper extension: `error.reason` subcodes per spec §7.0.
  - Zod schemas in `domain/schemas/`: `user`, `studentProfile`, `academicInfo`.
- Routes:
  - `POST /api/v1/auth/sync`
  - `GET /api/v1/users/:id` (+ `me` alias)
  - `PATCH /api/v1/users/:id` (+ `me` alias)

### Success criteria

- `POST /auth/sync` first call → 201 with `Location: /api/v1/users/{id}`, body includes `role: student`, `profileStatus: incomplete`, no `firebaseUid` leaked.
- `POST /auth/sync` repeat call → 200, same `id` returned.
- `POST /auth/sync` first-time student without `studentNumber` → 422.
- `GET /users/me` resolves to caller's own record; `ETag` header present.
- `GET /users/:id` by coordinator for any student → 200.
- `GET /users/:id` by student for a different student → 403.
- `GET /users/:id` unknown id → 404.
- `PATCH /users/:id` by owner with all required academic fields → 200, `profileStatus` flips to `complete`, `academicInfo.confirmedAt` set by server.
- `PATCH /users/:id` attempting to change `studentNumber` to a new value → 400; same value → no-op.
- `PATCH /users/:id` by coordinator → 405 with `Allow: GET`.
- `PATCH /users/:id` with stale `If-Match` → 412.
- `PATCH /users/:id` writing `email`/`role`/`firebaseUid`/`status`/`onboardingStage` → 400.

### Bug-finding cases

- Concurrent first-call `POST /auth/sync` for the same `firebaseUid` produce exactly one `users` document.
- A PATCH that leaves any required `academicInfo` field missing keeps `profileStatus: incomplete`.
- `confirmedAt` is NOT re-written on edits after the profile is already `complete`.
- A student PATCHing their own record cannot set `role: coordinator`.

### Notes

_(append terse status notes here during implementation)_

---

## Phase 2 — Semesters

**Status:** pending
**PR:** —

### Scope

- Zod schema for `semesters`.
- Routes: `GET /semesters`, `GET /semesters/:id`, `POST /semesters`, `PATCH /semesters/:id`, `POST /semesters/:id/transitions`.
- `activity` subcollection on semesters to store transition records.

### Success criteria

- `POST /semesters` by coordinator with valid body → 201 with `Location`.
- `POST /semesters` by student → 403.
- `POST /semesters` duplicate `(semesterCode, courseCode)` → 409 `natural_key_exists`.
- `POST /semesters` missing required fields → 422.
- `PATCH /semesters/:id` body containing `status`/`semesterCode`/`courseCode`/`id` → 400.
- `PATCH /semesters/:id` empty body → 422.
- `POST /semesters/:id/transitions` `draft → active` → 201, activity record written with `from`, `to`, `actorUserId`.
- `POST /semesters/:id/transitions` `archived → active` → 409 `invalid_state_transition`.
- `POST /semesters/:id/transitions` with stale `If-Match` → 412.

### Bug-finding cases

- Concurrent `POST /semesters` with the same natural key → exactly one succeeds, other returns 409.
- Transition record and parent status update are atomic (both or neither, via Firestore transaction).

### Notes

---

## Phase 3 — Student enrolment + workflow

**Status:** pending
**PR:** —

### Scope

- Routes: `PUT /api/v1/users/:id/semester-selection`, `GET /api/v1/users/:id/workflow`.
- Coarse `currentWorkflowStep` derivation (spec §7.1) and fine `internshipStatus` derivation (spec §9.2).

### Success criteria

- `PUT /semester-selection` with incomplete profile → 409 `profile_incomplete`.
- `PUT` referencing non-active semester → 409 `semester_not_active`.
- `PUT` outside enrolment window → 409 `enrolment_window_closed`.
- `PUT` first success sets `semesterSelectedAt`; subsequent PUTs leave it unchanged.
- `PUT /users/me/semester-selection` alias works.
- `PUT` by non-owner student → 403.
- `PUT` on coordinator user id → 404 (sub-resource does not exist for coordinators).
- `GET /users/:id/workflow` returns `currentWorkflowStep`, `internshipStatus`, `semesterEnrolmentState` per §7.1/§9.2 tables.
- `GET /workflow` for coordinator target → 404.

### Bug-finding cases

- Student whose profile completed mid-session can immediately PUT a semester without re-authenticating.
- `semesterEnrolmentState` reflects `window_closed` when the semester is active but the window has closed.

### Notes

---

## Phase 4 — Opportunities

**Status:** pending
**PR:** —

### Scope

- Zod schema for `opportunities` + `attachments` subcollection shape.
- Routes: `POST`, `GET` list, `GET /:id`, `PATCH /:id`, `POST /:id/transitions`, `POST /:id/verifications`.
- Career Hub domain allowlist validator.

### Success criteria

- Coordinator `POST` with `type: pre_approved` + valid Career Hub URL → 201, `status: draft`.
- Coordinator `POST` with `type: pre_approved` + non-allowlist URL → 422 `url_not_on_allowlist`.
- Student `POST` → 201, `status: pending_verification`, `type: custom` regardless of body; `semesterId` auto-set from `studentProfile.semesterId`.
- Student `POST` without a selected semester → 409 `student_has_no_selected_semester`.
- `POST` body containing `status` → 400.
- `GET` list by student shows only `published` + their semester; cannot widen filter.
- `GET` list by coordinator honours `status`, `type`, `semesterId` filters.
- `GET /:id` by student for unpublished or other-semester opportunity → 403.
- `PATCH /:id` by coordinator → 200; editable fields only.
- `PATCH /:id` attempting to write `status`/`semesterId`/`type` → 400.
- `POST /:id/transitions` coordinator `draft → published` → 201, activity record written.
- `POST /:id/transitions` `pending_verification → anything` → 409 (wrong endpoint).
- `POST /:id/verifications` `approved` → 201, `status: published`, `verifiedByUserId`/`verifiedAt` set, notification created for submitter.
- `POST /:id/verifications` `rejected` without comment → 422.
- `POST /:id/verifications` on non-`pending_verification` state → 409.

### Bug-finding cases

- Student passing another semester's id via `semesterId` query param → 400.
- `applicationCount` computed correctly on list response for coordinators.
- Transition + verification cannot both succeed if fired concurrently on the same doc.

### Notes

---

## Phase 5 — Internships (student path)

**Status:** pending
**PR:** —

### Scope

- Zod schema for `internships` + `activity` subcollection.
- Routes: `POST`, `GET` list, `GET /:id`, `PATCH /:id`, `POST /:id/offer-submissions`, `POST /:id/comments`.
- Denormalization of opportunity fields (`opportunityEmployerName`, `opportunityJobTitle`, `opportunityType`, `opportunitySourceUrl`, `studentProgramCode`) into list/get responses at query time.

### Success criteria

- Student `POST` with published opportunity in their semester → 201, `status: applied`, `version: 1`, activity `apply` written, coordinator `new_application` notification created.
- Student `POST` duplicate application for same opportunity → 409 `duplicate_application`.
- Student `POST` for unpublished opportunity → 409 `opportunity_not_published`.
- Student `POST` without selected semester → 409.
- Coordinator `POST` → 403 `role_restricted_action`.
- `POST /:id/offer-submissions` without any attachment → 422 `offer_attachment_missing`.
- `POST /:id/offer-submissions` in non-`applied`/`offer_changes_requested` state → 409.
- `POST /:id/offer-submissions` valid → 201, `status: offer_pending_review`, `lastSubmittedAt` set, activity `submit_offer` written.
- `PATCH /:id` by coordinator → 405 with `Allow: GET`.
- `PATCH /:id` in `offer_approved` or `rejected` → 409.
- `POST /:id/comments` by student owner or coordinator in any state (including terminal) → 201.
- `POST /:id/comments` empty text → 422.

### Bug-finding cases

- Denormalized opportunity fields appear on list and get responses.
- Resubmit path `offer_changes_requested → offer_pending_review` updates `lastSubmittedAt` and increments `version` (when PATCH accompanies resubmit).
- Comments do NOT rotate the internship's `ETag`.
- Student cannot read another student's internship (`403`).

### Notes

---

## Phase 6 — Coordinator decisions

**Status:** pending
**PR:** —

### Scope

- Route: `POST /api/v1/internships/:id/decisions`.
- Notification creation for `offer_decision` to the student.

### Success criteria

- `approved` from `offer_pending_review` → 201, `status: offer_approved`, activity `approve_offer`, `coordinatorDecision`/`reviewedByUserId`/`reviewedAt` populated.
- `changes_requested` without comment → 422.
- `rejected` without comment → 422.
- `changes_requested` from `offer_pending_review` → 201, `status: offer_changes_requested`, activity `request_changes`.
- `rejected` → 201, `status: rejected`, activity `reject`.
- Decision on non-reviewable state → 409 `invalid_state_transition`.
- Decision by student → 403.
- Stale `If-Match` → 412.
- `coordinatorDecision`, `reviewedByUserId`, `reviewedAt` persisted on the internship doc.
- Student receives an `offer_decision` notification record.

### Bug-finding cases

- Two coordinators racing on the same offer: second decision with `If-Match` → 412.
- Decision without `If-Match` is last-writer-wins (documented behaviour, not a bug).

### Notes

---

## Phase 7 — Activity feed

**Status:** pending
**PR:** —

### Scope

- Route: `GET /api/v1/users/:id/activity` via Firestore collection-group query on `activity`.
- `firestore.indexes.json` entry: collection group `activity` composite index on `authorUserId ASC` + `createdAt DESC`.

### Success criteria

- Returns only entries authored by the caller (`authorUserId == caller.id`).
- `internshipId` derived from parent path and returned in DTO.
- Default sort `-createdAt`; `sort=createdAt` accepted.
- Pagination returns `nextPageToken` when more results exist; `null` on last page.
- `GET /users/me/activity` alias works.
- `GET /users/:otherId/activity` → 403.
- Running the query without the composite index fails with a clear dev-time error referencing the missing index (verifies we declared it).

### Bug-finding cases

- Student and coordinator activity feeds both work through the same endpoint.
- Activity created in Phase 4/5/6 side-effects appears in the feed immediately.

### Notes

---

## Phase 8 — Notifications (Firestore only, no email)

**Status:** pending
**PR:** —

### Scope

- Zod schema for `notifications` (keep `emailDeliveryStatus` + `emailDeliveredAt` **nullable** for forward-compat).
- Routes: `GET /notifications`, `PATCH /notifications/:id`, `PUT /notifications`.
- Wire notification record creation into phases 4, 5, 6, 9 (retroactive if merged out of order).

### Success criteria

- `GET` returns only caller-owned records; `unreadCount` is total across pages (not current page).
- `GET` with `unreadOnly=true` filters correctly.
- `PATCH /:id { read: true }` sets `readAt` server-side; repeat call no-op, `readAt` unchanged.
- `PATCH /:id { read: false }` → 400.
- `PATCH /:id` with any field other than `read` → 400.
- `PATCH /:id` on another user's notification → 403.
- `PUT /notifications { read: true }` marks all caller's unread as read, returns `markedReadCount` = number transitioned.
- `PUT` with empty unread set → `markedReadCount: 0`.
- `emailDeliveryStatus` field is accepted as `null`/absent in all writes (forward-compat check).

### Bug-finding cases

- `markedReadCount` counts only transitions (unread → read), not already-read records.
- Caller cannot mark another user's notifications read via `PUT`.

### Notes

---

## Phase 9 — Tickets

**Status:** pending
**PR:** —

### Scope

- Zod schema for `tickets` + `replies` subcollection.
- Routes: `POST`, `GET` list, `GET /:id`, `POST /:id/replies`, `POST /:id/transitions`.

### Success criteria

- Student `POST /tickets` → 201, `status: open`.
- Coordinator `POST /tickets` → 403.
- `POST` missing subject/body → 422.
- `GET` list by student → only own; coordinator sees all.
- `GET /:id` by non-owner student → 403.
- `POST /:id/replies` by owner or coordinator → 201, parent `updatedAt` bumped, counterparty notification created.
- `POST /:id/transitions` per allowed-transitions table:
  - coordinator `open → in_progress` → 201
  - student owner `open → closed` → 201
  - student owner `open → in_progress` → 403 `role_restricted_action`
  - student owner `resolved → open` (reopen) → 201
  - coordinator `closed → open` → 403 (reopen is owner-only)
- `POST /:id/transitions` invalid state pair → 409 `invalid_state_transition`.
- Stale `If-Match` → 412.

### Bug-finding cases

- Reply from student triggers coordinator notification and vice versa.
- Transition records land in an `activity` subcollection with `actorRole` populated.

### Notes

---

## Phase 10 — Attachments + Storage trigger

**Status:** pending
**PR:** —

### Scope

- Routes: `GET /opportunities/:id/attachments/:attachmentId`, `GET /internships/:id/attachments/:attachmentId` with short-lived V4 signed Cloud Storage URLs.
- Cloud Storage `onObjectFinalized` function that parses the storage path, verifies prefix ownership, and writes attachment metadata into the correct `attachments` subcollection.
- Re-submit attachment replacement semantics (spec §7.0 "File upload pattern").

### Success criteria

- `GET` returns `downloadUrl` + `downloadUrlExpiresAt`; each GET produces a fresh URL.
- Student cannot `GET` attachment on an unpublished or other-semester opportunity → 403.
- Student cannot `GET` another student's internship attachment → 403.
- `GET` for non-existent attachment id → 404.
- Storage object written to an invalid path prefix is NOT reflected into Firestore (trigger rejects it).
- Internship re-submit replaces old attachment records and files (old files removed, only latest present in subcollection).
- Offer submission in Phase 5 blocks at `422 offer_attachment_missing` until at least one attachment has been synced via the trigger.

### Bug-finding cases

- Signed URL TTL is honoured — URL past `downloadUrlExpiresAt` returns Storage-level 403.
- Coordinator cannot write attachments directly (no PUT/POST attachment route exists in v1).

### Notes
