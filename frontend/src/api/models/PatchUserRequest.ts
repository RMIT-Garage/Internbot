/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { StudentProfilePatch } from './StudentProfilePatch'
/**
 * Body for PATCH /api/v1/users/:id. Top-level identity fields (email, role, firebaseUid, status, onboardingStage) are rejected with 400.
 */
export type PatchUserRequest = {
  studentProfile: StudentProfilePatch
}
