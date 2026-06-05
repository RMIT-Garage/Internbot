import './extendZodOpenApi'
import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi'
import { openApiRegistry } from './registry'
import { registerOpenApiPaths } from './registerPaths'

let initialized = false

function ensurePathsRegistered(): void {
  if (initialized) return
  registerOpenApiPaths(openApiRegistry)
  initialized = true
}

export function getOpenApiDocument(): Record<string, unknown> {
  ensurePathsRegistered()
  const generator = new OpenApiGeneratorV31(openApiRegistry.definitions)
  const baseUrl = process.env.PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? ''
  const servers = baseUrl.length > 0 ? [{ url: baseUrl }] : [{ url: '/' }]

  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Interbot RAG API',
      version: '1.0.0',
      description:
        'Public HTTP API for FAQ RAG, job checker, and contract checker. Authenticate with a platform API key (`Authorization: Bearer ibk_*`).',
    },
    servers,
    tags: [
      { name: 'Health', description: 'Public liveness' },
      { name: 'Chat', description: 'AI chat and model listing (API key required)' },
    ],
  }) as unknown as Record<string, unknown>
}
