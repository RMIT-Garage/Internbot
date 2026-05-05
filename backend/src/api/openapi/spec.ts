import { createDocument, type ZodOpenApiObject } from 'zod-openapi'
import { healthOperation } from './operations/health'
import {
  getMyProfileOperation,
  getUserOperation,
  patchMyProfileOperation,
  patchUserOperation,
  putMySemesterSelectionOperation,
  putUserSemesterSelectionOperation,
  getMyWorkflowOperation,
  getUserWorkflowOperation,
  getMyActivityOperation,
  getUserActivityOperation,
} from './operations/users'
import {
  listSemestersOperation,
  getSemesterOperation,
  createSemesterOperation,
  patchSemesterOperation,
  transitionSemesterOperation,
} from './operations/semesters'
import {
  listOpportunitiesOperation,
  getOpportunityOperation,
  createOpportunityOperation,
  patchOpportunityOperation,
  transitionOpportunityOperation,
  verifyOpportunityOperation,
} from './operations/opportunities'
import {
  listInternshipsOperation,
  getInternshipOperation,
  createInternshipOperation,
  patchInternshipOperation,
  submitInternshipOfferOperation,
  addInternshipCommentOperation,
  decideInternshipOfferOperation,
} from './operations/internships'

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
      { name: 'Users', description: 'Platform user records.' },
      { name: 'Semesters', description: 'Semester records and lifecycle transitions.' },
      { name: 'Opportunities', description: 'Semester-scoped internship opportunities.' },
      { name: 'Internships', description: 'Student internship applications and offer workflow.' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'Firebase ID token',
          description:
            'Firebase ID token obtained client-side. Platform identity is hydrated at the api edge from `userIdentities/{provider}__{uid}` → `users/{id}` on every request; on a brand-new student-shape email the hydrator JIT-creates the platform record in the same transaction. See docs/WORKFLOW-API-SPEC.md §7.0.',
        },
      },
    },
    paths: {
      '/api/health': { get: healthOperation },
      '/api/v1/users/me': { get: getMyProfileOperation, patch: patchMyProfileOperation },
      '/api/v1/users/me/workflow': { get: getMyWorkflowOperation },
      '/api/v1/users/me/activity': { get: getMyActivityOperation },
      '/api/v1/users/me/semester-selection': { put: putMySemesterSelectionOperation },
      '/api/v1/users/{id}': { get: getUserOperation, patch: patchUserOperation },
      '/api/v1/users/{id}/workflow': { get: getUserWorkflowOperation },
      '/api/v1/users/{id}/activity': { get: getUserActivityOperation },
      '/api/v1/users/{id}/semester-selection': { put: putUserSemesterSelectionOperation },
      '/api/v1/semesters': { get: listSemestersOperation, post: createSemesterOperation },
      '/api/v1/semesters/{id}': { get: getSemesterOperation, patch: patchSemesterOperation },
      '/api/v1/semesters/{id}/transitions': { post: transitionSemesterOperation },
      '/api/v1/opportunities': {
        get: listOpportunitiesOperation,
        post: createOpportunityOperation,
      },
      '/api/v1/opportunities/{id}': {
        get: getOpportunityOperation,
        patch: patchOpportunityOperation,
      },
      '/api/v1/opportunities/{id}/transitions': { post: transitionOpportunityOperation },
      '/api/v1/opportunities/{id}/verifications': { post: verifyOpportunityOperation },
      '/api/v1/internships': {
        get: listInternshipsOperation,
        post: createInternshipOperation,
      },
      '/api/v1/internships/{id}': {
        get: getInternshipOperation,
        patch: patchInternshipOperation,
      },
      '/api/v1/internships/{id}/offer-submissions': {
        post: submitInternshipOfferOperation,
      },
      '/api/v1/internships/{id}/comments': { post: addInternshipCommentOperation },
      '/api/v1/internships/{id}/decisions': { post: decideInternshipOfferOperation },
    },
  })
}
