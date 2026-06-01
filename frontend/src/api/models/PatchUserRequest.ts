/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { StudentProfilePatch } from './StudentProfilePatch'
/**
 * Body for PATCH /api/v1/users/:id. `displayName` and `studentProfile` are both writable and optional (send either or both). Other top-level identity fields (email, role, firebaseUid, status, onboardingStage) are rejected with 400.
 */
export type PatchUserRequest = {
  /**
   * The student-facing display name. Self-settable after sign-up (registration no longer captures a name). Trimmed; 1–100 chars.
   */
  displayName?: string
  studentProfile?: StudentProfilePatch
}
