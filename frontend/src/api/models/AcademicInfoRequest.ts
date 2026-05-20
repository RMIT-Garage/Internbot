/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type AcademicInfoRequest = {
  programName: string
  programLevel: AcademicInfoRequest.programLevel
  unitsAttempted: number
  creditUnitsEarned: number
  /**
   * GPA on the RMIT /4.0 scale.
   */
  gpa: number
  currentStudyLoad: AcademicInfoRequest.currentStudyLoad
  programStatus?: AcademicInfoRequest.programStatus
  majors?: Array<string>
  minors?: Array<string>
  notes?: string
}
export namespace AcademicInfoRequest {
  export enum programLevel {
    UNDERGRADUATE = 'undergraduate',
    POSTGRADUATE = 'postgraduate',
  }
  export enum currentStudyLoad {
    FULL_TIME = 'full_time',
    PART_TIME = 'part_time',
    UNKNOWN = 'unknown',
  }
  export enum programStatus {
    ACTIVE_IN_PROGRAM = 'active_in_program',
    COMPLETED = 'completed',
    DISCONTINUED = 'discontinued',
  }
}
