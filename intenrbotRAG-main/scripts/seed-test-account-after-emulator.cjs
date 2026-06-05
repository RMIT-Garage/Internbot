#!/usr/bin/env node
'use strict'

const { spawnSync } = require('child_process')

const healthUrl = process.env.FIREBASE_EMULATOR_HEALTH_URL || 'http://127.0.0.1:4000'
const maxAttempts = Number.parseInt(process.env.TEST_ACCOUNT_SEED_MAX_ATTEMPTS || '30', 10)
const delayMs = Number.parseInt(process.env.TEST_ACCOUNT_SEED_RETRY_DELAY_MS || '1000', 10)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForEmulatorReady() {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(healthUrl)
      if (response.ok) return
    } catch {
      // emulator still booting
    }
    await sleep(delayMs)
  }

  throw new Error(
    `Firebase emulators did not become ready at ${healthUrl} after ${maxAttempts} attempts.`,
  )
}

function runSeedScript() {
  const result = spawnSync('node', ['scripts/ensure-test-account.cjs'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.error) {
    throw result.error
  }
  if ((result.status ?? 1) !== 0) {
    throw new Error(`Test account seeding failed with exit code ${result.status ?? 1}`)
  }
}

async function main() {
  await waitForEmulatorReady()
  runSeedScript()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
