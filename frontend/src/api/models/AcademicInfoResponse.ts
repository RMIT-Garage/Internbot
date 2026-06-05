/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Confirmed academic information on a student profile (see §8.2B).
 */
export type AcademicInfoResponse = {
  programName: string
  programLevel: AcademicInfoResponse.programLevel
  programStatus?: AcademicInfoResponse.programStatus
  majors?: Array<string>
  minors?: Array<string>
  unitsAttempted: number
  creditUnitsEarned: number
  /**
   * GPA on the RMIT /4.0 scale
   */
  gpa: number
  currentStudyLoad: AcademicInfoResponse.currentStudyLoad
  /**
   * Self-attested completed course codes. Always present (empty array when none recorded).
   */
  completedCourses: Array<string>
  /**
   * Derived current year level from creditUnitsEarned on a 96-CP/year load, clamped to [1, 4]. Not persisted.
   */
  yearLevel: number
  notes?: string
  /**
   * Set once at first profile-complete transition; not rewritten on subsequent edits.
   */
  confirmedAt: string | null
}
export namespace AcademicInfoResponse {
  export enum programLevel {
    UNDERGRADUATE = 'undergraduate',
    POSTGRADUATE = 'postgraduate',
  }
  export enum programStatus {
    ACTIVE_IN_PROGRAM = 'active_in_program',
    COMPLETED = 'completed',
    DISCONTINUED = 'discontinued',
  }
  export enum currentStudyLoad {
    FULL_TIME = 'full_time',
    PART_TIME = 'part_time',
    UNKNOWN = 'unknown',
  }
}
