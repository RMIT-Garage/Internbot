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
import prettier from 'prettier'
import { buildOpenapiDocument } from '../src/api/openapi/spec'

/**
 * Emit a prettier-formatted openapi.json. Running prettier here (not just
 * via the pre-commit hook) keeps the generator the single source of truth
 * for formatting — `openapi:check` in CI will match locally-committed
 * output regardless of whether pre-commit ran.
 */
async function main(): Promise<void> {
  const output = resolve(__dirname, '..', 'openapi.json')
  const doc = buildOpenapiDocument()
  const raw = JSON.stringify(doc, null, 2)
  // Resolve project prettier config (.prettierrc in backend/) so the
  // generator matches the pre-commit hook exactly — same printWidth,
  // same quote style, etc. Without this, prettier.format() would use
  // defaults (printWidth: 80) and produce drift vs the committed file.
  const config = (await prettier.resolveConfig(output)) ?? {}
  const formatted = await prettier.format(raw, { ...config, parser: 'json', filepath: output })
  writeFileSync(output, formatted, 'utf8')
  // eslint-disable-next-line no-console
  console.log(`openapi → ${output}`)
}

void main()
