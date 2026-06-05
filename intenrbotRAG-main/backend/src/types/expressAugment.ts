/* eslint-disable @typescript-eslint/no-namespace -- Express merges `Request` via global namespace */
/// <reference types="express" />

export {}

declare global {
  namespace Express {
    interface Request {
      /** Set by API key middleware for `/api/v1` protected routes */
      apiKeyAuth?: {
        kind: 'api_key'
        keyId: string
        platform: string
        env: 'live' | 'test'
      }
    }
  }
}
