/**
 * Enum value sets for the semester aggregate. `as const` tuples so they can
 * be used both as types (string-literal unions) and at runtime (Zod / membership
 * checks at the boundary layers). Pure TypeScript — no runtime deps.
 */

export const semesterStatusValues = [
  'draft',
  'enrollment_open',
  'placement_running',
  'reporting',
  'archived',
] as const
export type SemesterStatus = (typeof semesterStatusValues)[number]

/**
 * Targets accepted by `POST /semesters/:id/transitions`. Note: `draft` is
 * never a valid transition target — semesters start at `draft` and move
 * forward only. See WORKFLOW-API-SPEC.md §7.5.
 *
 * Allowed transitions:
 *   draft            → enrollment_open | archived
 *   enrollment_open  → placement_running | archived
 *   placement_running→ reporting | archived
 *   reporting        → archived
 */
export const semesterTransitionTargetValues = [
  'enrollment_open',
  'placement_running',
  'reporting',
  'archived',
] as const
export type SemesterTransitionTarget = (typeof semesterTransitionTargetValues)[number]

/**
 * Type discriminator for entries in `semesters/{id}/activity/{auto}`. Reserved
 * for the activity feed — Phase 7 surfaces these via collection-group query.
 */
export const semesterActivityTypeValues = ['transition'] as const
export type SemesterActivityType = (typeof semesterActivityTypeValues)[number]
