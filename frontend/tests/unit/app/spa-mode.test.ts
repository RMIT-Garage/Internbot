/**
 * Guardrail: this frontend ships as a static SPA, deployed to Firebase Hosting.
 *
 * There is **no Node runtime in production** — the entire `output: 'export'`
 * pipeline assumes only client-side JS at runtime. The features below either
 * require a server or pull `firebase-admin` (server-only SDK), so they must
 * never appear in `src/`:
 *
 *   - `'use server'` directives (Server Actions)
 *   - `src/app/api/**` route handlers
 *   - `middleware.ts` / `proxy.ts`
 *   - `firebase-admin` imports
 *   - `next/headers` / `next/cookies` imports
 *
 * A single regression here breaks the build (or worse, silently fails at
 * runtime with cryptic export errors on Firebase Hosting). This test pins
 * the SPA contract.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

const FRONTEND = resolve(__dirname, '../../..')
const SRC = join(FRONTEND, 'src')

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walk(full, files)
    } else if (/\.(tsx?|mjs|cjs|js)$/.test(entry)) {
      files.push(full)
    }
  }
  return files
}

const sourceFiles = walk(SRC)

describe('SPA / static export contract', () => {
  it("next.config.ts sets output: 'export'", () => {
    const cfg = readFileSync(join(FRONTEND, 'next.config.ts'), 'utf8')
    expect(cfg).toMatch(/output:\s*['"]export['"]/)
  })

  it('next.config.ts sets images.unoptimized: true', () => {
    const cfg = readFileSync(join(FRONTEND, 'next.config.ts'), 'utf8')
    expect(cfg).toMatch(/unoptimized:\s*true/)
  })

  it("no file declares 'use server'", () => {
    const violations = sourceFiles.filter((file) =>
      /^['"]use server['"]/m.test(readFileSync(file, 'utf8'))
    )
    expect(violations).toEqual([])
  })

  it('no src/app/api route handlers exist', () => {
    expect(existsSync(join(SRC, 'app', 'api'))).toBe(false)
  })

  it('no middleware.ts / proxy.ts at the project root', () => {
    expect(existsSync(join(SRC, 'middleware.ts'))).toBe(false)
    expect(existsSync(join(SRC, 'proxy.ts'))).toBe(false)
    expect(existsSync(join(FRONTEND, 'middleware.ts'))).toBe(false)
    expect(existsSync(join(FRONTEND, 'proxy.ts'))).toBe(false)
  })

  it('no file imports firebase-admin', () => {
    const violations = sourceFiles.filter((file) =>
      /from\s+['"]firebase-admin/.test(readFileSync(file, 'utf8'))
    )
    expect(violations).toEqual([])
  })

  it('no file imports next/headers or next/cookies (server-only APIs)', () => {
    const violations = sourceFiles.filter((file) =>
      /from\s+['"]next\/(headers|cookies)['"]/.test(readFileSync(file, 'utf8'))
    )
    expect(violations).toEqual([])
  })
})
