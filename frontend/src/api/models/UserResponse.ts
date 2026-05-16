/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CoordinatorUserResponse } from './CoordinatorUserResponse'
import type { StudentUserResponse } from './StudentUserResponse'
/**
 * Polymorphic user record — shape depends on `role`.
 */
export type UserResponse = StudentUserResponse | CoordinatorUserResponse
