/**
 * Architecture boundary tests.
 *
 * Enforces Clean Architecture dependency rule:
 *   domain ← application ← infrastructure ← api
 *
 * Each layer may only import from layers to its left (inner layers).
 * Violations are caught here before they silently drift.
 *
 * Also enforces:
 *   - infrastructure/config/firebaseAdmin is the sole Firebase Admin entry point
 *   - No console.log in any src/ file
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const SRC = path.resolve(__dirname, '../../../src')

function getFiles(dir: string, ext = '.ts'): string[] {
  if (!fs.existsSync(dir)) return []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...getFiles(full, ext))
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      files.push(full)
    }
  }
  return files
}

function getContent(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8')
}

function getImportedPaths(filePath: string): string[] {
  const content = getContent(filePath)
  const matches = [...content.matchAll(/from\s+['"]([^'"]+)['"]/g)]
  return matches.map((m) => m[1] ?? '')
}

describe('Architecture boundaries', () => {
  describe('domain/ — must not import application/, infrastructure/, or api/', () => {
    const domainDir = path.join(SRC, 'domain')
    const files = getFiles(domainDir)

    if (files.length === 0) {
      it('domain/ has no files yet (skip)', () => expect(true).toBe(true))
    }

    for (const file of files) {
      const rel = path.relative(SRC, file)
      it(`${rel} only imports from domain/`, () => {
        for (const imp of getImportedPaths(file)) {
          const isRelative = imp.startsWith('.')
          if (!isRelative) continue
          const resolved = path.resolve(path.dirname(file), imp)
          const relResolved = path.relative(SRC, resolved)
          expect(
            relResolved,
            `${rel} imports '${imp}' which resolves outside domain/ — domain must be dependency-free`
          ).toMatch(/^domain/)
        }
      })
    }
  })

  describe('application/ — must not import infrastructure/ or api/', () => {
    const appDir = path.join(SRC, 'application')
    const files = getFiles(appDir)

    if (files.length === 0) {
      it('application/ has no files yet (skip)', () => expect(true).toBe(true))
    }

    for (const file of files) {
      const rel = path.relative(SRC, file)
      it(`${rel} does not import infrastructure/ or api/`, () => {
        for (const imp of getImportedPaths(file)) {
          const isRelative = imp.startsWith('.')
          if (!isRelative) continue
          const resolved = path.resolve(path.dirname(file), imp)
          const relResolved = path.relative(SRC, resolved)
          expect(
            relResolved,
            `${rel} imports '${imp}' — application/ must not depend on infrastructure/ or api/`
          ).not.toMatch(/^(infrastructure|api)/)
        }
      })
    }
  })

  describe('infrastructure/ — must not import api/', () => {
    const infraDir = path.join(SRC, 'infrastructure')
    const files = getFiles(infraDir)

    if (files.length === 0) {
      it('infrastructure/ has no files yet (skip)', () => expect(true).toBe(true))
    }

    for (const file of files) {
      const rel = path.relative(SRC, file)
      it(`${rel} does not import api/`, () => {
        for (const imp of getImportedPaths(file)) {
          const isRelative = imp.startsWith('.')
          if (!isRelative) continue
          const resolved = path.resolve(path.dirname(file), imp)
          const relResolved = path.relative(SRC, resolved)
          expect(
            relResolved,
            `${rel} imports '${imp}' — infrastructure/ must not depend on api/`
          ).not.toMatch(/^api/)
        }
      })
    }
  })

  describe('api/routes/ — must not import firebase-admin directly', () => {
    const routesDir = path.join(SRC, 'api', 'routes')
    const files = getFiles(routesDir)

    if (files.length === 0) {
      it('api/routes/ has no files yet (skip)', () => expect(true).toBe(true))
    }

    for (const file of files) {
      const rel = path.relative(SRC, file)
      it(`${rel} uses infrastructure/config/firebaseAdmin instead of firebase-admin directly`, () => {
        const hasDirectAdminImport = /from\s+['"]firebase-admin/.test(getContent(file))
        expect(
          hasDirectAdminImport,
          `${rel} imports firebase-admin directly — use infrastructure/config/firebaseAdmin instead`
        ).toBe(false)
      })
    }
  })

  describe('no console.log in source files', () => {
    const allFiles = getFiles(SRC)

    for (const file of allFiles) {
      const rel = path.relative(SRC, file)
      it(`${rel} has no console.log statements`, () => {
        const lines = getContent(file).split('\n')
        const violations = lines
          .map((line, i) => ({ line, num: i + 1 }))
          .filter(({ line }) => /console\.log\s*\(/.test(line))
          .map(({ num }) => num)

        expect(
          violations,
          `${rel} has console.log at line(s): ${violations.join(', ')} — remove before merging`
        ).toEqual([])
      })
    }
  })
})
