import { afterEach, beforeEach, vi } from 'vitest'

/**
 * Frozen wall clock for all unit tests.
 *
 * Unit tests are domain-only. A few domain rules still read `new Date()`
 * directly, so the unit tier keeps a frozen wall clock for deterministic
 * fixtures.
 *
 * `shouldAdvanceTime: true` lets `setTimeout`/`setInterval` still tick on
 * a real timeline so tests using async timers (none today, but cheap
 * insurance) don't hang. Tests that need a different "now" can call
 * `vi.setSystemTime(...)` inside the test — the afterEach resets.
 *
 * Export `TEST_NOW` so fixtures can align (`createdAt: TEST_NOW`,
 * `enrolmentOpenAt: addDays(TEST_NOW, -7)` etc.) and stay legible.
 */
export const TEST_NOW = new Date('2026-04-01T00:00:00Z')

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: TEST_NOW })
})

afterEach(() => {
  vi.useRealTimers()
})
