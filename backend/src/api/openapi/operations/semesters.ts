import type { ZodOpenApiOperationObject } from 'zod-openapi'
import { z } from 'zod'
import {
  createSemesterRequestSchema,
  patchSemesterRequestSchema,
  transitionSemesterRequestSchema,
} from '../../schemas/semester'
import { semesterResponseSchema, semesterListResponseSchema } from '../../dto/semester'
import { errorResponseSchema } from '../common'
import { semesterStatusValues } from '../../../domain/value-objects/semester-enums'

const semesterIdPathParams = z.object({
  id: z.string().meta({ example: 'sem_aBc123XyZ', description: 'Platform semester id.' }),
})

const ifMatchHeaderSchema = z.object({
  'if-match': z.string().optional().meta({
    description: 'Opt-in optimistic concurrency — the current ETag from a prior GET.',
  }),
})

const listSemestersQuerySchema = z.object({
  // Multi-value supported per WORKFLOW-API-SPEC.md §7.5: repeat the param
  // (`?status=draft&status=active`). OpenAPI renders this as
  // `style: form, explode: true` (the default for query arrays).
  status: z.array(z.enum(semesterStatusValues)).optional().meta({
    description:
      'Filter by status. Repeat the param for multi-value (`?status=draft&status=active`).',
  }),
  semesterCode: z.string().optional(),
  courseCode: z.string().optional(),
  limit: z.number().int().min(1).max(200).optional(),
  pageToken: z.string().optional(),
  sort: z
    .enum(['createdAt', '-createdAt', 'enrolmentOpenAt', '-enrolmentOpenAt'])
    .optional()
    .meta({ description: 'Default `-createdAt`. Prefix with `-` for descending.' }),
})

export const listSemestersOperation: ZodOpenApiOperationObject = {
  operationId: 'listSemesters',
  summary: 'List semesters with optional filters and pagination',
  description:
    'Returns semesters configured in the app. Any authenticated platform user may list. See WORKFLOW-API-SPEC.md §7.5.',
  tags: ['Semesters'],
  security: [{ bearerAuth: [] }],
  requestParams: { query: listSemestersQuerySchema },
  responses: {
    '200': {
      description: 'Paginated list of semesters.',
      content: { 'application/json': { schema: semesterListResponseSchema } },
    },
    '400': {
      description: 'Malformed query string (unknown sort field, invalid filter, etc.).',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '401': {
      description: 'Missing or invalid Firebase ID token.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '403': {
      description: 'Caller has no platform user record.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}

export const getSemesterOperation: ZodOpenApiOperationObject = {
  operationId: 'getSemester',
  summary: 'Return a semester by id',
  description:
    'Any authenticated platform user may read. Response carries an `ETag` clients can echo as `If-Match` on subsequent PATCH / transition calls. See WORKFLOW-API-SPEC.md §7.5.',
  tags: ['Semesters'],
  security: [{ bearerAuth: [] }],
  requestParams: { path: semesterIdPathParams },
  responses: {
    '200': {
      description: 'Semester found.',
      headers: { ETag: { schema: { type: 'string' } } },
      content: { 'application/json': { schema: semesterResponseSchema } },
    },
    '401': {
      description: 'Missing or invalid Firebase ID token.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '403': {
      description: 'Caller has no platform user record.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '404': {
      description: 'No semester exists with the supplied id.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}

export const createSemesterOperation: ZodOpenApiOperationObject = {
  operationId: 'createSemester',
  summary: 'Create a semester',
  description:
    'Coordinator-only. Natural-key uniqueness on `(semesterCode, courseCode)` is enforced atomically — concurrent calls produce exactly one document. See WORKFLOW-API-SPEC.md §7.5.',
  tags: ['Semesters'],
  security: [{ bearerAuth: [] }],
  requestBody: {
    required: true,
    content: { 'application/json': { schema: createSemesterRequestSchema } },
  },
  responses: {
    '201': {
      description: 'Semester created.',
      headers: {
        Location: { schema: { type: 'string' } },
        ETag: { schema: { type: 'string' } },
      },
      content: { 'application/json': { schema: semesterResponseSchema } },
    },
    '400': {
      description: 'Malformed body (unknown enum, bad ISO timestamp, etc.).',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '401': {
      description: 'Missing or invalid Firebase ID token.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '403': {
      description: 'Caller is not a coordinator.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '409': {
      description: 'Duplicate `(semesterCode, courseCode)` tuple.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '422': {
      description: 'Body parsed but missing required fields.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}

export const patchSemesterOperation: ZodOpenApiOperationObject = {
  operationId: 'patchSemester',
  summary: 'Update a semester (label and enrolment window only)',
  description:
    'Coordinator-only. `id`, `semesterCode`, `courseCode`, `status` are immutable through this endpoint — use `POST /semesters/:id/transitions` for status changes. See WORKFLOW-API-SPEC.md §7.5.',
  tags: ['Semesters'],
  security: [{ bearerAuth: [] }],
  requestParams: { path: semesterIdPathParams, header: ifMatchHeaderSchema },
  requestBody: {
    required: true,
    content: { 'application/json': { schema: patchSemesterRequestSchema } },
  },
  responses: {
    '200': {
      description: 'Semester updated.',
      headers: { ETag: { schema: { type: 'string' } } },
      content: { 'application/json': { schema: semesterResponseSchema } },
    },
    '400': {
      description: 'Body contains immutable / unknown fields.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '401': {
      description: 'Unauthorized.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '403': {
      description: 'Caller is not a coordinator.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '404': {
      description: 'No semester exists with the supplied id.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '412': {
      description: 'Stale `If-Match`.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '422': {
      description: 'Empty body.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}

export const transitionSemesterOperation: ZodOpenApiOperationObject = {
  operationId: 'transitionSemester',
  summary: "Advance a semester's lifecycle status",
  description:
    'Coordinator-only. Allowed: `draft → active`, `draft → archived`, `active → archived`. Anything else returns 409 `invalid_state_transition`. Writes an activity record alongside the status update. See WORKFLOW-API-SPEC.md §7.5.',
  tags: ['Semesters'],
  security: [{ bearerAuth: [] }],
  requestParams: { path: semesterIdPathParams, header: ifMatchHeaderSchema },
  requestBody: {
    required: true,
    content: { 'application/json': { schema: transitionSemesterRequestSchema } },
  },
  responses: {
    '201': {
      description: 'Transition applied; activity record written.',
      headers: {
        Location: { schema: { type: 'string' } },
        ETag: { schema: { type: 'string' } },
      },
      content: { 'application/json': { schema: semesterResponseSchema } },
    },
    '400': {
      description: 'Malformed body (`to` missing or invalid).',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '401': {
      description: 'Unauthorized.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '403': {
      description: 'Caller is not a coordinator.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '404': {
      description: 'No semester exists with the supplied id.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '409': {
      description: 'Disallowed state transition.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '412': {
      description: 'Stale `If-Match`.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}
