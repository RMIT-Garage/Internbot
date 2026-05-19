/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { HealthResponse } from '../models/HealthResponse'
import type { CancelablePromise } from '../core/CancelablePromise'
import { OpenAPI } from '../core/OpenAPI'
import { request as __request } from '../core/request'
export class HealthService {
  /**
   * Health probe
   * Public, unauthenticated. Returns 200 when the backend is serving requests.
   * @returns HealthResponse Service is healthy
   * @throws ApiError
   */
  public static getHealth(): CancelablePromise<HealthResponse> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/health',
    })
  }
}
