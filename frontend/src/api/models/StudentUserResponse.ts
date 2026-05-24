/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CurrentWorkflowStep } from './CurrentWorkflowStep'
import type { StudentProfileResponse } from './StudentProfileResponse'
/**
 * User record for role=student. Includes studentProfile and workflow step.
 */
export type StudentUserResponse = {
  id: string
  email: string
  displayName: string | null
  status: StudentUserResponse.status
  onboardingStage: StudentUserResponse.onboardingStage
  role: 'student'
  currentWorkflowStep: CurrentWorkflowStep
  studentProfile: StudentProfileResponse
}
export namespace StudentUserResponse {
  export enum status {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    BLOCKED = 'blocked',
  }
  export enum onboardingStage {
    PROFILE_PENDING = 'profile_pending',
    PROFILE_COMPLETE = 'profile_complete',
  }
}
