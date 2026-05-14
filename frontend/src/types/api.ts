/**
 * Frontend mirror of selected backend API response DTOs.
 *
 * Source of truth: backend/openapi.json (and the Zod schemas in
 * backend/src/api/dto/*). These types must be kept in sync; consider
 * generating them from the OpenAPI document in a follow-up.
 */

export type Role = 'student' | 'coordinator'
export type UserStatus = 'active' | 'invited' | 'disabled'
export type OnboardingStage = 'profile_pending' | 'profile_complete' | 'semester_selected'

export type CurrentWorkflowStep =
  | 'profile_pending'
  | 'semester_selection_pending'
  | 'opportunity_search'
  | 'opportunity_verification'
  | 'offer_review'
  | 'internship_active'
  | 'internship_complete'

export interface UserResponseBase {
  id: string
  email: string
  displayName: string | null
  status: UserStatus
  onboardingStage: OnboardingStage
}

export interface StudentUserResponse extends UserResponseBase {
  role: 'student'
  currentWorkflowStep: CurrentWorkflowStep
  studentProfile: {
    studentNumber: string
    profileStatus: 'incomplete' | 'complete'
  }
}

export interface CoordinatorUserResponse extends UserResponseBase {
  role: 'coordinator'
}

export type UserResponse = StudentUserResponse | CoordinatorUserResponse
