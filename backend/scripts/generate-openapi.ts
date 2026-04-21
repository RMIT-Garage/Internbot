#!/usr/bin/env tsx
/**
 * Generates `backend/openapi.json` from the current Zod-backed spec so the
 * committed file can drive frontend codegen + act as a drift sentinel in CI.
 *
 * Used two ways:
 *   1. `pnpm --filter backend run openapi:generate` — write the file locally
 *   2. `pnpm --filter backend run openapi:check` — write to a temp file and
 *      fail if it differs from the committed one (CI spec-freeze guard)
 *
 * The runtime-served `/api/openapi.json` uses `buildOpenapiDocument(servers)`
 * with the current origin; this script emits an origin-less doc so the file
 * is deterministic across environments.
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildOpenapiDocument } from '../src/api/openapi/spec'

const output = resolve(__dirname, '..', 'openapi.json')
const doc = buildOpenapiDocument()
writeFileSync(output, JSON.stringify(doc, null, 2) + '\n', 'utf8')
// eslint-disable-next-line no-console
console.log(`openapi → ${output}`)
