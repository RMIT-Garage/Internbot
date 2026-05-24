/**
 * Guardrail: no legacy `brand-*` Tailwind utility classes remain in source.
 *
 * The codebase historically had two parallel red palettes — `brand-*` on the
 * auth pages and `red-*` everywhere else. We unified on `red-*` (with @theme
 * overrides pointing at RMIT red). Reintroducing `brand-*` would split the
 * palette again and quietly bring back the inconsistency.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

const SRC = resolve(__dirname, '../../../src')

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walk(full, files)
    } else if (/\.(tsx?|css)$/.test(entry)) {
      files.push(full)
    }
  }
  return files
}

const sourceFiles = walk(SRC)

describe('no legacy `brand-*` Tailwind classes in source', () => {
  it('no file references `bg-brand-`, `text-brand-`, `border-brand-`, `ring-brand-`, `from-brand-`, `to-brand-`, `outline-brand-`, etc.', () => {
    const violations: Array<{ file: string; line: number; text: string }> = []
    const pattern =
      /\b(?:bg|text|border|ring|from|to|via|outline|fill|stroke|placeholder|caret|accent|decoration|divide|shadow)-brand-/

    for (const file of sourceFiles) {
      const src = readFileSync(file, 'utf8')
      const lines = src.split('\n')
      lines.forEach((line, idx) => {
        if (pattern.test(line)) {
          violations.push({ file, line: idx + 1, text: line.trim() })
        }
      })
    }

    expect(violations).toEqual([])
  })
})
