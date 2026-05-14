/**
 * Architecture boundary tests.
 *
 * Enforces Clean Architecture dependency rule:
 *   domain ← application ← infrastructure ← {api, workers}
 *
 * `api/` (HTTP transport) and `workers/` (event-bus transport) are peer
 * outermost layers — both may import from inner layers but never from each
 * other. Violations are caught here before they silently drift.
 *
 * Also enforces:
 *   - infrastructure/config/firebase-admin is the sole Firebase Admin entry point
 *   - unit tests stay domain-only; application/api behavior is covered by
 *     integration/component tests
 *   - No console.log in any src/ file
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const SRC = path.resolve(__dirname, '../../src')
const TESTS = path.resolve(__dirname, '..')

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

  describe('infrastructure/ — must not import api/ or workers/', () => {
    const infraDir = path.join(SRC, 'infrastructure')
    const files = getFiles(infraDir)

    if (files.length === 0) {
      it('infrastructure/ has no files yet (skip)', () => expect(true).toBe(true))
    }

    for (const file of files) {
      const rel = path.relative(SRC, file)
      it(`${rel} does not import api/ or workers/`, () => {
        for (const imp of getImportedPaths(file)) {
          const isRelative = imp.startsWith('.')
          if (!isRelative) continue
          const resolved = path.resolve(path.dirname(file), imp)
          const relResolved = path.relative(SRC, resolved)
          expect(
            relResolved,
            `${rel} imports '${imp}' — infrastructure/ must not depend on api/ or workers/`
          ).not.toMatch(/^(api|workers)/)
        }
      })
    }
  })

  describe('workers/ — must not import api/ (peer outermost transports)', () => {
    const workersDir = path.join(SRC, 'workers')
    const files = getFiles(workersDir)

    if (files.length === 0) {
      it('workers/ has no files yet (skip)', () => expect(true).toBe(true))
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
            `${rel} imports '${imp}' — workers/ and api/ are peer transports; route HTTP through api/, events through workers/`
          ).not.toMatch(/^api/)
        }
      })
    }
  })

  describe('api/ — must not import workers/ (peer outermost transports)', () => {
    const apiDir = path.join(SRC, 'api')
    const files = getFiles(apiDir)

    for (const file of files) {
      const rel = path.relative(SRC, file)
      it(`${rel} does not import workers/`, () => {
        for (const imp of getImportedPaths(file)) {
          const isRelative = imp.startsWith('.')
          if (!isRelative) continue
          const resolved = path.resolve(path.dirname(file), imp)
          const relResolved = path.relative(SRC, resolved)
          expect(
            relResolved,
            `${rel} imports '${imp}' — api/ must not reach into workers/`
          ).not.toMatch(/^workers/)
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
      it(`${rel} uses infrastructure/config/firebase-admin instead of firebase-admin directly`, () => {
        const hasDirectAdminImport = /from\s+['"]firebase-admin/.test(getContent(file))
        expect(
          hasDirectAdminImport,
          `${rel} imports firebase-admin directly — use infrastructure/config/firebase-admin instead`
        ).toBe(false)
      })
    }
  })

  describe('domain/ — must not import zod or firebase-admin (pure TS)', () => {
    const domainDir = path.join(SRC, 'domain')
    const files = getFiles(domainDir)

    for (const file of files) {
      const rel = path.relative(SRC, file)
      it(`${rel} does not import zod or firebase-admin`, () => {
        const content = getContent(file)
        expect(
          /from\s+['"]zod['"]/.test(content),
          `${rel} imports zod — domain must be pure TypeScript`
        ).toBe(false)
        expect(
          /from\s+['"]firebase-admin/.test(content),
          `${rel} imports firebase-admin — domain must not depend on persistence`
        ).toBe(false)
      })
    }
  })

  describe('application/ — must not import zod, firebase-admin, api/, or workers/', () => {
    const appDir = path.join(SRC, 'application')
    const files = getFiles(appDir)

    for (const file of files) {
      const rel = path.relative(SRC, file)
      it(`${rel} does not import zod, firebase-admin, or reach into api/ or workers/`, () => {
        const content = getContent(file)
        expect(
          /from\s+['"]zod['"]/.test(content),
          `${rel} imports zod — application must not own validation`
        ).toBe(false)
        expect(
          /from\s+['"]firebase-admin/.test(content),
          `${rel} imports firebase-admin — application must not depend on persistence`
        ).toBe(false)
        for (const imp of getImportedPaths(file)) {
          if (!imp.startsWith('.')) continue
          const resolved = path.resolve(path.dirname(file), imp)
          const relResolved = path.relative(SRC, resolved)
          expect(
            relResolved,
            `${rel} imports '${imp}' — application/ must not reach into api/ or workers/`
          ).not.toMatch(/^(api|workers)/)
        }
      })
    }
  })

  describe('IdGenerator port boundary', () => {
    const portFile = path.join(SRC, 'application', 'ports', 'id-generator.ts')
    const implFile = path.join(SRC, 'infrastructure', 'firestore', 'firestore-id-generator.ts')

    it('IdGenerator port lives at application/ports/id-generator.ts and exports next(): string', () => {
      expect(fs.existsSync(portFile), 'application/ports/id-generator.ts must exist').toBe(true)
      const content = getContent(portFile)
      expect(content).toMatch(/export interface IdGenerator/)
      expect(content).toMatch(/next\s*\(\s*\)\s*:\s*string/)
    })

    it('Firestore impl declares `implements IdGenerator` against the port type', () => {
      expect(
        fs.existsSync(implFile),
        'infrastructure/firestore/firestore-id-generator.ts must exist'
      ).toBe(true)
      const content = getContent(implFile)
      expect(content, 'impl must import the port from application/ports/').toMatch(
        /from\s+['"][^'"]*application\/ports\/id-generator['"]/
      )
      expect(content, 'impl must declare `implements IdGenerator`').toMatch(
        /implements\s+IdGenerator/
      )
    })

    it('application/ depends on the IdGenerator port, never the FirestoreIdGenerator impl', () => {
      const violations: string[] = []
      for (const file of getFiles(path.join(SRC, 'application'))) {
        if (/firestoreIdGenerator|FirestoreIdGenerator/.test(getContent(file))) {
          violations.push(path.relative(SRC, file))
        }
      }
      expect(
        violations,
        `application/ must consume IdGenerator (port), not FirestoreIdGenerator (impl). Violations: ${violations.join(', ') || 'none'}`
      ).toEqual([])
    })
  })

  describe('Entity invariants — version field & domain purity', () => {
    const entitiesDir = path.join(SRC, 'domain', 'entities')
    const files = getFiles(entitiesDir)

    if (files.length === 0) {
      it('domain/entities/ has no files yet (skip)', () => expect(true).toBe(true))
      return
    }

    for (const file of files) {
      const rel = path.relative(SRC, file)
      const content = getContent(file)

      it(`${rel} declares 'readonly version: number' in its props interface`, () => {
        expect(
          /readonly\s+version\s*:\s*number/.test(content),
          `${rel} must declare 'readonly version: number' — every aggregate carries an app-managed concurrency token`
        ).toBe(true)
      })

      it(`${rel} exposes a 'version' getter`, () => {
        expect(
          /get\s+version\s*\(\s*\)\s*:\s*number/.test(content),
          `${rel} must expose 'get version(): number' — callers (mappers, repos) read it through the public API`
        ).toBe(true)
      })

      it(`${rel} does NOT define a version-mutating method`, () => {
        // Domain mutators must never touch `version` — it's bumped exclusively
        // by the repo on successful persistence. See backend/CLAUDE.md.
        const forbidden = [
          /bumpVersion\s*\(/,
          /incrementVersion\s*\(/,
          /setVersion\s*\(/,
          /this\.#props\.version\s*=/,
          /this\.#props\.version\+\+/,
        ]
        const hits = forbidden.filter((re) => re.test(content)).map((re) => re.source)
        expect(
          hits,
          `${rel} mutates 'version' via [${hits.join(', ')}] — version is a persistence concern, only the repo may bump it`
        ).toEqual([])
      })
    }
  })

  describe('Repository invariants — version bump on save', () => {
    const reposDir = path.join(SRC, 'infrastructure', 'firestore')
    const files = getFiles(reposDir).filter(
      (f) =>
        /firestore-.*-repository\.ts$/.test(f) && !/firestore-activity-feed-repository\.ts$/.test(f)
    )

    if (files.length === 0) {
      it('infrastructure/firestore/ has no repository files yet (skip)', () =>
        expect(true).toBe(true))
      return
    }

    for (const file of files) {
      const rel = path.relative(SRC, file)
      const content = getContent(file)

      it(`${rel} reads stored version and bumps to 'stored + 1' inside the txn`, () => {
        // Two structural checks: (1) reads `version` from the stored snap,
        // (2) writes `stored + 1` somewhere. Both are required for the
        // optimistic-concurrency contract — a repo without these is silently
        // last-write-wins.
        const readsStoredVersion =
          /snap\.data\(\)\??\.\['version'\]/.test(content) ||
          /storage\.version/.test(content) ||
          /stored\s*=\s*.*version/.test(content)
        const writesBumped =
          /stored\s*\+\s*1/.test(content) || /version:\s*nextVersion/.test(content)
        expect(
          readsStoredVersion,
          `${rel} doesn't read stored 'version' — optimistic-concurrency check is missing`
        ).toBe(true)
        expect(
          writesBumped,
          `${rel} doesn't write 'stored + 1' — version isn't being bumped on save`
        ).toBe(true)
      })

      it(`${rel} declares 'version' on its Zod storage schema`, () => {
        expect(
          /version:\s*z\.number\(\)\.int\(\)\.nonnegative\(\)/.test(content),
          `${rel} must declare 'version: z.number().int().nonnegative()' on its storage schema`
        ).toBe(true)
      })
    }
  })

  describe('Firestore indexes', () => {
    const indexesFile = path.resolve(
      __dirname,
      '../../../docker/firebase-emulator/firebase/firestore.indexes.json'
    )

    it('declares the Phase 7 activity-feed collection-group index', () => {
      const manifest = JSON.parse(getContent(indexesFile)) as {
        indexes?: Array<{
          collectionGroup?: string
          queryScope?: string
          fields?: Array<{ fieldPath?: string; order?: string }>
        }>
      }
      const hasActivityIndex = (createdAtOrder: 'ASCENDING' | 'DESCENDING') =>
        manifest.indexes?.some(
          (index) =>
            index.collectionGroup === 'activity' &&
            index.queryScope === 'COLLECTION_GROUP' &&
            index.fields?.some(
              (field) => field.fieldPath === 'authorUserId' && field.order === 'ASCENDING'
            ) &&
            index.fields?.some(
              (field) => field.fieldPath === 'createdAt' && field.order === createdAtOrder
            )
        ) ?? false

      expect(
        hasActivityIndex('DESCENDING'),
        'GET /users/:id/activity needs collection-group activity index: authorUserId ASC + createdAt DESC'
      ).toBe(true)
      expect(
        hasActivityIndex('ASCENDING'),
        'GET /users/:id/activity?sort=createdAt needs collection-group activity index: authorUserId ASC + createdAt ASC'
      ).toBe(true)
    })

    it('declares the Phase 8 notifications list and unread indexes', () => {
      const manifest = JSON.parse(getContent(indexesFile)) as {
        indexes?: Array<{
          collectionGroup?: string
          queryScope?: string
          fields?: Array<{ fieldPath?: string; order?: string }>
        }>
      }
      const hasNotificationIndex = (fields: Array<{ fieldPath: string; order: string }>) =>
        manifest.indexes?.some(
          (index) =>
            index.collectionGroup === 'notifications' &&
            index.queryScope === 'COLLECTION' &&
            fields.every((expected) =>
              index.fields?.some(
                (field) => field.fieldPath === expected.fieldPath && field.order === expected.order
              )
            )
        ) ?? false

      expect(
        hasNotificationIndex([
          { fieldPath: 'userId', order: 'ASCENDING' },
          { fieldPath: 'createdAt', order: 'DESCENDING' },
        ]),
        'GET /notifications needs userId ASC + createdAt DESC'
      ).toBe(true)
      expect(
        hasNotificationIndex([
          { fieldPath: 'userId', order: 'ASCENDING' },
          { fieldPath: 'readAt', order: 'ASCENDING' },
          { fieldPath: 'createdAt', order: 'DESCENDING' },
        ]),
        'GET /notifications?unreadOnly=true and PUT /notifications need userId ASC + readAt ASC + createdAt DESC'
      ).toBe(true)
    })
  })

  describe('test pyramid — unit tests stay domain-only', () => {
    const unitDir = path.join(TESTS, 'unit')
    const files = getFiles(unitDir).filter((file) => file.endsWith('.test.ts'))

    if (files.length === 0) {
      it('tests/unit/ has no test files yet (skip)', () => expect(true).toBe(true))
      return
    }

    it('has no API or application unit tests', () => {
      const violations = files
        .map((file) => path.relative(unitDir, file))
        .filter((rel) => !rel.startsWith(`domain${path.sep}`))

      expect(
        violations,
        `Unit tests must stay under tests/unit/domain/**. Cover application handlers with integration tests and API/mappers with component tests. Violations: ${violations.join(', ') || 'none'}`
      ).toEqual([])
    })
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
