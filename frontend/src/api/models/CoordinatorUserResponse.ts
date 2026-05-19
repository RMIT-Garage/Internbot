/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * User record for role=coordinator. Identity fields only, no studentProfile.
 */
export type CoordinatorUserResponse = {
  id: string
  email: string
  displayName: string | null
  status: CoordinatorUserResponse.status
  onboardingStage: CoordinatorUserResponse.onboardingStage
  role: 'coordinator'
}
export namespace CoordinatorUserResponse {
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
