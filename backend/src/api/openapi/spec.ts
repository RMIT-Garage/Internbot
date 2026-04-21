import { createDocument, type ZodOpenApiObject } from 'zod-openapi'
import { healthOperation } from './operations/health'
import { authSyncOperation } from './operations/auth'
import { getUserOperation, patchUserOperation } from './operations/users'

type OpenapiDocument = ReturnType<typeof createDocument>
type OpenapiServer = NonNullable<ZodOpenApiObject['servers']>[number]

/**
 * Assemble the full OpenAPI 3.1 document for the Internbot API.
 *
 * `servers` is injected by the caller — `api/routes/openapi.ts` builds it
 * from the current request's origin, so `/api/openapi.json` always reflects
 * wherever it's being served from (emulator, dev, prod) with zero hardcoded
 * URLs.
 *
 * Schemas referenced in operations are auto-lifted into `components/schemas`
 * by zod-openapi when they carry `.meta({ id })` (see api/dto/user.ts and
 * api/schemas/user.ts). `security` at the root defines the bearer scheme;
 * per-operation `security: [{ bearerAuth: [] }]` opts in.
 */
export function buildOpenapiDocument(servers: readonly OpenapiServer[] = []): OpenapiDocument {
  return createDocument({
    openapi: '3.1.0',
    info: {
      title: 'Internbot API',
      version: '1.0.0',
      description:
        'Backend workflow API for the Internbot internship platform. Source of truth: [WORKFLOW-API-SPEC.md](https://github.com/giatinhuynh/Internbot/blob/develop/docs/WORKFLOW-API-SPEC.md).',
    },
    servers: servers.length > 0 ? (servers as OpenapiServer[]) : undefined,
    tags: [
      { name: 'Health', description: 'Public health probe.' },
      { name: 'Authentication', description: 'Firebase identity sync.' },
      { name: 'Users', description: 'Platform user records.' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'Firebase ID token',
          description:
            'Firebase ID token obtained client-side. Platform identity (`platformUserId`, `role`) is read from custom claims; see docs/WORKFLOW-API-SPEC.md §7.0.',
        },
      },
    },
    paths: {
      '/api/health': { get: healthOperation },
      '/api/v1/auth/sync': { post: authSyncOperation },
      '/api/v1/users/{id}': { get: getUserOperation, patch: patchUserOperation },
    },
  })
}
