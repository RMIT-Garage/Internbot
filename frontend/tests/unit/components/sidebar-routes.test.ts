/**
 * Guardrail: every sidebar href must resolve to a real page.tsx on disk.
 *
 * Without this, refactors that move/rename routes silently leave the sidebar
 * pointing at dead URLs that 404 only under `output: 'export'`. This test
 * catches the entire bug class up-front by walking the app/ directory tree
 * and matching each sidebar href against the actual route filesystem.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

const APP_DIR = resolve(__dirname, '../../../src/app')
const SIDEBAR_FILES = [
  '../../../src/components/student/StudentSidebar.tsx',
  '../../../src/components/coordinator/CoordinatorSidebar.tsx',
]

function extractHrefs(source: string): string[] {
  // Matches href: '/some/path' in object literals (matches all sidebars' navItems).
  const hrefs: string[] = []
  for (const m of source.matchAll(/href:\s*['"]([^'"]+)['"]/g)) {
    const value = m[1]
    if (value && value.startsWith('/')) hrefs.push(value)
  }
  return hrefs
}

function listRoutes(dir: string, prefix = ''): Set<string> {
  const routes = new Set<string>()
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (!statSync(full).isDirectory()) continue
    // Route groups like (auth) and (dashboard) do not contribute to the URL.
    const segment = entry.startsWith('(') && entry.endsWith(')') ? '' : `/${entry}`
    // page.tsx at this level makes the prefix+segment a real route.
    try {
      statSync(join(full, 'page.tsx'))
      routes.add(prefix + segment || '/')
    } catch {
      /* no page.tsx at this level — keep walking */
    }
    for (const child of listRoutes(full, prefix + segment)) routes.add(child)
  }
  return routes
}

function normalizeForMatch(href: string): string {
  // Strip query strings and trailing slashes for comparison.
  return href.replace(/[?#].*$/, '').replace(/\/$/, '') || '/'
}

const routes = listRoutes(APP_DIR)

describe('sidebar hrefs map to real routes', () => {
  for (const relPath of SIDEBAR_FILES) {
    const absPath = resolve(__dirname, relPath)
    const source = readFileSync(absPath, 'utf8')
    const hrefs = extractHrefs(source)

    it(`${relPath} declares at least one navItem href`, () => {
      expect(hrefs.length).toBeGreaterThan(0)
    })

    for (const href of hrefs) {
      it(`${relPath} → ${href} resolves to a real page.tsx`, () => {
        expect(routes).toContain(normalizeForMatch(href))
      })
    }
  }
})
