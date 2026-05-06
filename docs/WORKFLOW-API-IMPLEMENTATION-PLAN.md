# Workflow API — Implementation Plan

Implementation roadmap for [WORKFLOW-API-SPEC.md](./WORKFLOW-API-SPEC.md).

- **Jira epic:** `IC-56` (Backend Workflow API v1). Each phase gets its own child Story (`IC-57` … created as each phase starts) with frozen Scope / Success criteria / Bug-finding cases copied from this file.
- **Cadence:** one backend PR per phase, merged to `develop` behind feature branches per [GIT-WORKFLOW.md](./GIT-WORKFLOW.md). **Parallel vertical-slice delivery** — once a backend phase merges, backend Phase N+1 starts immediately while frontend implements the unblocked `US-*` stories against the freshly-merged API. Frontend and backend run concurrently; `develop` accumulates both as they land. Both halves of Phase N must be merged before we consider that phase "demoable."
- **Out of scope (v1):** AI endpoints (`/ai-reviews`, `/faq`) and email delivery on notifications. Structural hooks remain so both can be added later without migrations.
- **Global definition of done (every backend phase):**
  - `pnpm --filter backend run typecheck` + `lint` pass
  - **Test pyramid** per [docs/TESTING.md](./TESTING.md) — every phase ships all applicable levels:
    - **Unit tests** only for domain classes/rules. Do not unit-test API routes, API mappers, or CQRS handlers.
    - **Integration tests** against the Firestore emulator for CQRS handlers, every new repository method, and every Firestore query.
    - **Component (API) tests** against Firestore + Firebase Auth emulators — **one `it(...)` per Success-criteria bullet and per Bug-finding bullet**. Component tests are the definitive contract check for routes, wire DTOs, and mappers.
  - No new `eslint-disable` comments
  - Docs updated for any deviation from the spec
  - PR title carries `[IC-XX]` prefix and commits carry an `IC-XX` trailer

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

**Status:** done
**Jira:** [IC-57](https://internbot.atlassian.net/browse/IC-57)
**Backend PR:** [#18](https://github.com/giatinhuynh/Internbot/pull/18) (merged as `a067ac9`) + [#19](https://github.com/giatinhuynh/Internbot/pull/19) (lefthook follow-up, merged as `0912be2`)
**Frontend follow-up PR:** _pending (can start once backend merges to develop — runs in parallel with Phase 2 backend)_
**Unblocks frontend stories:** [IC-26](https://internbot.atlassian.net/browse/IC-26) US-003 Firestore schema + Cloud Functions scaffold (primary), [IC-27](https://internbot.atlassian.net/browse/IC-27) US-004 Next.js role-aware routing, [IC-52](https://internbot.atlassian.net/browse/IC-52) US-025 Profile Settings page. `IC-57` has "blocks" links to all three in Jira.

### Notes

- Architecture scope grew beyond the original plan: full Clean Arch + DDD + CQRS scaffold (per-layer data models, class-based domain, class-based CQRS handlers with flat DI, port/adapter split, `application/ports/`, `infrastructure/services/`, `translate-firestore-errors` boundary wrapper). This pays off across Phases 2–10 — every later phase reuses the scaffold.
- Auth model: Firebase custom claims carry `{ platformUserId, role }`. `POST /auth/sync` sets them via the `PlatformClaimsService` port. Subsequent requests read identity directly from the token — no per-request Firestore lookup.
- Authz lives inline inside each CQRS handler. Route handlers do authentication (via middleware) + body validation + dispatch + serialization — never authz.
- Naming convention settled: kebab-case files/folders, PascalCase classes/interfaces, camelCase identifiers.
- Later within phase 1: aggregate pattern tightened to Vernon-style — private `#props` + getters + private ctor + `create`/`rehydrate` factories; `User` is **mutable** (`change*`/`set*`/`clear*` void methods); VOs stay immutable with `with*`. Repository port shrinks to `findById` / `findByIdentity` / `create(user, identity)` / `save(user)` — optimistic concurrency enforced inside `save()` via `updateTime.toMillis()`, no client-side version increment. Command shape: `actor`/`userId`/`patch`/`metadata?: CommandMetadata` — business intent on the command, transport metadata (expectedVersion, future correlationId/idempotencyKey) nested under `metadata`. `backend/CLAUDE.md` slimmed to rules + pointers; canonical reference is `docs/BACKEND.md`.

### Scope

- Shared foundations bundled into this phase (every later phase depends on them):
  - Platform-id resolver: `POST /auth/sync` resolves `userIdentities/firebase__{token.uid}` and custom claims populate `actor.{id, role}` on later requests.
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

**Status:** done
**Jira:** [IC-58](https://internbot.atlassian.net/browse/IC-58)
**PR:** [#24](https://github.com/giatinhuynh/Internbot/pull/24) (merged as `27ef60d` on 2026-04-28; reached main via release PR [#26](https://github.com/giatinhuynh/Internbot/pull/26))

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

- Implementation lands the full vertical slice: domain aggregate (`Semester` + `SemesterTransition` VO with state-machine guard), CQRS handlers (create/update/transition + get/list queries), Firestore repo with in-txn natural-key uniqueness and atomic `recordTransition` (parent status + activity subcollection in one txn), `/api/v1/semesters` router, OpenAPI spec, all three test tiers.
- Test pyramid: 286 tests across 24 files passing — 220 unit (incl. architecture rules), 31 integration (Firestore emulator), 35 component (Firestore + Auth emulator). One `it(...)` per Phase 2 Success criteria + Bug-finding bullet in `tests/component/routes/semesters.test.ts`.
- Storage schema accepts `null` on `enrolmentOpenAt` / `enrolmentCloseAt` so PATCH writes can clear the field (mapped back to `undefined` on the domain side).
- Route-level POST distinguishes `422 missing_required_field` from `400 invalid_body` via Zod v4's `invalid_type` issue + "received undefined" message text (Zod v4 dropped the structured `received` field from its issue payload).
- Shipped to develop and prod as part of release PR #26 / #41 — running on `internbot-dev-ae3a3` and `internbot-prod`.

---

## Phase 3 — Student enrolment + workflow

**Status:** done
**Jira:** [IC-58](https://internbot.atlassian.net/browse/IC-58) (bundled with Phase 2)
**PR:** [#24](https://github.com/giatinhuynh/Internbot/pull/24) (merged as `27ef60d` on 2026-04-28; reached main via release PR [#26](https://github.com/giatinhuynh/Internbot/pull/26))

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

- Domain: added `User.selectSemester(semesterId, now)` (delegates to `StudentProfile.withSemester`, which already preserves first-set `semesterSelectedAt`); new `domain/value-objects/workflow-state.ts` (coarse + fine + enrolment-state vocabularies); new `domain/services/workflow-derivation.ts` centralizing the §7.1 / §9.2 / §7.2 derivation. Mapper-level `deriveWorkflowStep` removed — `toUserResponse` now flows through the same derivation function future phases will extend.
- Application: `SelectSemesterCommandHandler` (3-step validation chain: complete profile → active semester → open enrolment window) + `GetUserWorkflowQueryHandler` (loads referenced semester only when set; tolerant of dangling refs). Both follow Phase 1/2 conventions (inline authz, `metadata.expectedVersion`, returns `{ id }`).
- API: `PUT /api/v1/users/{id}/semester-selection` + `/me` alias, `GET /api/v1/users/{id}/workflow` + `/me` alias. New schemas, DTOs, mappers, OpenAPI operations. Snapshot `backend/openapi.json` regenerated.
- Tests: 350 / 350 across 29 files. Unit: `User.selectSemester` (4 tests), `deriveWorkflowState` (7), `SelectSemesterCommandHandler` (11), `GetUserWorkflowQueryHandler` (7). Integration (Firestore emulator): 8 tests covering all 409 paths and the `semesterSelectedAt`-set-once invariant. Component (Firestore + Auth emulators): 11 tests, one `it(...)` per Success-criteria + Bug-finding bullet.
- Shipped to develop and prod alongside Phase 2 via release PRs #26 / #41 — running on `internbot-dev-ae3a3` and `internbot-prod`.

---

## Phase 4 — Opportunities

**Status:** implemented
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

- Implemented full Phase 4 backend vertical slice: Opportunity aggregate + transition/verification audit intents, Career Hub allowlist validation, Firestore repository with versioned saves, applicationCount read model, Notification aggregate/repository write on verification, `/api/v1/opportunities` routes, OpenAPI snapshot, Firestore indexes, and domain-unit plus integration/component coverage.
- Coverage policy corrected after merge: Phase 4 keeps domain unit tests only; application/CQRS behavior is covered by integration tests and API/mappers by component tests.

---

## Phase 5 — Internships (student path)

**Status:** implemented
**PR:** https://github.com/giatinhuynh/Internbot/pull/50

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

- Implemented full Phase 5 backend vertical slice: Internship aggregate + activity value object, duplicate-application sentinel, Firestore repository with attachments/activity support, application handlers and query read models, `/api/v1/internships` routes, OpenAPI operations, workflow derivation from internship states, Firestore indexes, and domain-unit plus integration/component coverage.

---

## Phase 6 — Coordinator decisions

**Status:** implemented
**PR:** https://github.com/giatinhuynh/Internbot/pull/51

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

- Implemented Phase 6 coordinator decision slice: `Internship.decideOffer(...)` owns review-state transitions and comment requirements; `POST /api/v1/internships/{id}/decisions` records `approve_offer` / `request_changes` / `reject` activity, persists coordinator review metadata, rotates the internship `ETag`, and creates an `offer_decision` notification for the student. Coverage follows the domain-unit + integration + component split.

---

## Phase 7 — Activity feed

**Status:** implemented
**PR:** https://github.com/giatinhuynh/Internbot/pull/52

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

- Implemented Phase 7 activity feed slice: `GET /api/v1/users/{id}/activity` and `/users/me/activity` enforce owner-only access, read through a Firestore `activity` collection-group query keyed by `authorUserId`, derive resource ids from parent paths, support `createdAt` sorting and cursor pagination, and surface internship plus opportunity workflow activity. Added the required collection-group indexes and coverage through integration/component tests; no API/application unit tests added per coverage policy.

---

## Phase 8 — Notifications (Firestore only, no email)

**Status:** implemented
**PR:** https://github.com/giatinhuynh/Internbot/pull/53

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

- Implemented Phase 8 notifications slice: `/api/v1/notifications` GET/PATCH/PUT, owner-scoped list/read/bulk-read commands, Firestore notification repository queries/indexes, nullable/absent email delivery fields preserved for future email delivery, OpenAPI operations, and coverage via domain-unit plus integration/component tests only (no API/application unit tests per coverage policy).

---

## Phase 9 — Tickets

**Status:** implemented
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

- Spec deviation: added two notification types not in §7.8 — `new_ticket` (fanout to all coordinators on creation) and `ticket_transition` (sent to the counterparty on state change). `ticket_reply` is parameterized by replier role and routed to the counterparty (student → all coordinators, coordinator → ticket owner).
- Ticket activity uses `actorUserId` (not `authorUserId`), so the Phase 7 cross-resource activity-feed query never matches ticket activity docs — keeps tickets out of the user activity feed deliberately.
- Firestore subcollections present: `tickets/{id}/replies` and `tickets/{id}/activity`. Spec §8.1A only listed `replies`; schema is now broader than the doc suggests.
- Added 6 composite indexes for `tickets` (userId/createdAt asc+desc, status/createdAt asc+desc, userId+status+createdAt asc+desc) plus a `body` field exemption.
- Repository `applyTransition` rotates `version` (used as ETag); `addReply` only bumps `updatedAt` so replies don't invalidate concurrent edits to the parent.

---

## Phase 10 — Attachments + Storage trigger

**Status:** implemented
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

- Implemented Phase 10 attachments slice: signed download endpoints, Storage finalize worker, attachment value objects/path parsing, Firestore attachment sync with internship replacement semantics, default-deny Storage rules, OpenAPI/docs, and coverage via domain-unit plus integration/component tests only (no API/application unit tests per coverage policy).
