/**
 * Enum value sets for the user aggregate. Kept as `as const` tuples so they can
 * be used both as types (string-literal unions) and at runtime (e.g. membership
 * checks in Zod schemas at the boundary layers). Pure TypeScript — no runtime deps.
 */

export const roleValues = ['student', 'coordinator'] as const
export type Role = (typeof roleValues)[number]

export const userStatusValues = ['active', 'inactive', 'blocked'] as const
export type UserStatus = (typeof userStatusValues)[number]

export const onboardingStageValues = ['profile_pending', 'profile_complete'] as const
export type OnboardingStage = (typeof onboardingStageValues)[number]

export const profileStatusValues = ['incomplete', 'complete'] as const
export type ProfileStatus = (typeof profileStatusValues)[number]

export const programLevelValues = ['undergraduate', 'postgraduate'] as const
export type ProgramLevel = (typeof programLevelValues)[number]

export const programStatusValues = ['active_in_program', 'completed', 'discontinued'] as const
export type ProgramStatus = (typeof programStatusValues)[number]

export const studyLoadValues = ['full_time', 'part_time', 'unknown'] as const
export type StudyLoad = (typeof studyLoadValues)[number]
