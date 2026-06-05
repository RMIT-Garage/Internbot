/**
 * Write OpenAPI 3.1 JSON to dist/openapi.json (for CI or publishing).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { getOpenApiDocument } from '../src/api/openapi/generator'

/** npm/pnpm scripts run with cwd set to this package root */
const outPath = join(process.cwd(), 'dist', 'openapi.json')

const doc = getOpenApiDocument()
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
// eslint-disable-next-line no-console
console.info(`Wrote ${outPath}`)
