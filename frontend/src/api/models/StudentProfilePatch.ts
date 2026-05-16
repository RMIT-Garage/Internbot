/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AcademicInfoRequest } from './AcademicInfoRequest'
export type StudentProfilePatch = {
  /**
   * Same value as first-sync is a no-op; a different value returns 400 `immutable_field`.
   */
  studentNumber?: string
  programCode?: string
  phone?: string | null
  /**
   * Replace the academic info block, or `null` to clear it (returns the profile to incomplete).
   */
  academicInfo?: AcademicInfoRequest | null
}
