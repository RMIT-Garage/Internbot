/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AcademicInfoResponse } from './AcademicInfoResponse'
/**
 * Embedded student profile on a User response (see §8.2A).
 */
export type StudentProfileResponse = {
  studentNumber: string
  programCode: string | null
  phone: string | null
  academicInfo: AcademicInfoResponse | null
  semesterId?: string | null
  semesterSelectedAt?: string | null
  profileStatus: StudentProfileResponse.profileStatus
}
export namespace StudentProfileResponse {
  export enum profileStatus {
    INCOMPLETE = 'incomplete',
    COMPLETE = 'complete',
  }
}
