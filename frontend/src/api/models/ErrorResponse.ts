/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ErrorBody } from './ErrorBody'
/**
 * RFC 9457 Problem Details wrapped with the domain error envelope — see docs/ERROR-HANDLING.md.
 */
export type ErrorResponse = {
  type: string
  title: string
  status: number
  detail: string
  error: ErrorBody
}
