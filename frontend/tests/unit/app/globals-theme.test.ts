/**
 * Guardrail: the RMIT brand palette in `app/globals.css` must override
 * Tailwind's default `red-*` scale.
 *
 * Why this matters: every existing `bg-red-700` etc. across the codebase
 * relies on these @theme overrides to render in RMIT red, not Tailwind's
 * stock crimson. Quietly reverting one of these values would silently
 * un-brand the entire app — visible only on the eye, not in any compile
 * or runtime check.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const css = readFileSync(resolve(__dirname, '../../../src/app/globals.css'), 'utf8')

describe('RMIT brand tokens in globals.css', () => {
  const expectedReds: Record<string, string> = {
    '--color-red-50': '#fef2f4',
    '--color-red-100': '#fde2e7',
    '--color-red-200': '#fbc7cf',
    '--color-red-500': '#e20f2d',
    '--color-red-600': '#c50d27',
    '--color-red-700': '#a30b20',
    '--color-red-900': '#5d0612',
  }

  for (const [token, hex] of Object.entries(expectedReds)) {
    it(`${token} is the RMIT-faithful ${hex}`, () => {
      const re = new RegExp(`${token}:\\s*${hex.replace('#', '#?')}`)
      expect(css).toMatch(re)
    })
  }

  it('--color-rmit-red exists as a semantic alias', () => {
    expect(css).toMatch(/--color-rmit-red:\s*var\(--color-red-500\)/)
  })

  it('--color-rmit-black exists as a semantic alias', () => {
    expect(css).toMatch(/--color-rmit-black:\s*#?[0-9a-f]{3,8}/i)
  })

  it('no legacy `brand-*` tokens remain (migrated to `red-*`)', () => {
    expect(css).not.toMatch(/--color-brand-/)
  })
})
