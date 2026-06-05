#!/usr/bin/env node
/**
 * First-time local setup: pnpm install, env templates, Docker emulators.
 * Run from repo root: pnpm run bootstrap
 */
'use strict'

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const root = path.resolve(__dirname, '..')
process.chdir(root)

const warn = (m) => console.warn(`\n\x1b[33m${m}\x1b[0m`)
const err = (m) => console.error(`\n\x1b[31m${m}\x1b[0m`)

function runPnpm(args) {
  const r = spawnSync('pnpm', args, {
    stdio: 'inherit',
    cwd: root,
    shell: process.platform === 'win32',
  })
  if (r.error) {
    err(`Failed to run pnpm: ${r.error.message}`)
    process.exit(1)
  }
  if ((r.status ?? 1) !== 0) process.exit(r.status ?? 1)
}

function dockerOk() {
  const r = spawnSync('docker', ['info'], {
    stdio: 'pipe',
    cwd: root,
    shell: process.platform === 'win32',
  })
  return (r.status ?? 1) === 0
}

function copyEnvIfMissing(relExample, relTarget) {
  const src = path.join(root, relExample)
  const dest = path.join(root, relTarget)
  if (!fs.existsSync(src)) {
    console.log(`  (skip) ${relExample} not found`)
    return
  }
  if (fs.existsSync(dest)) {
    console.log(`  (keep) ${relTarget} already exists`)
    return
  }
  fs.copyFileSync(src, dest)
  console.log(`  (new)  ${relTarget} ← ${relExample}`)
}

function checkFirebaserc() {
  const fp = path.join(root, '.firebaserc')
  if (!fs.existsSync(fp)) return
  let data
  try {
    data = JSON.parse(fs.readFileSync(fp, 'utf8'))
  } catch {
    return
  }
  const def = data?.projects?.default
  if (typeof def === 'string' && (def.includes('REPLACE_WITH') || def.trim() === '')) {
    warn(
      '.firebaserc still uses a template project id. Set projects.default to your real Firebase project id (same as FIREBASE_PROJECT_ID).',
    )
  }
}

console.log('\n=== interbotRAG: bootstrap (first-time local setup) ===\n')

if (!dockerOk()) {
  err('Docker is not running. Start Docker Desktop (or the Docker daemon), then run: pnpm run bootstrap')
  process.exit(1)
}
console.log('Docker: OK\n')

console.log('Installing dependencies…\n')
runPnpm(['install'])

console.log('\nEnvironment files (only create if missing)…')
copyEnvIfMissing('frontend/.env.example', 'frontend/.env.local')
copyEnvIfMissing('backend/.env.example', 'backend/.env')
copyEnvIfMissing('.env.example', '.env')

checkFirebaserc()

console.log('\nFirebase emulators (Docker build + start)…\n')
runPnpm(['run', 'emulator:setup'])

console.log(`
┌─────────────────────────────────────────────────────────────────
│ Next steps (you do these once per Firebase project)
└─────────────────────────────────────────────────────────────────

  1. Firebase console → project; enable Auth, Firestore, Storage.
  2. Project settings → Service account → JSON → base64 → paste the SAME value as
     FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 in BOTH frontend/.env.local AND backend/.env
     (README → "Set up Firebase" for commands).
  3. Project settings → Your apps → web app → copy values into frontend/.env.local:
     NEXT_PUBLIC_FIREBASE_* , NEXT_PUBLIC_APP_URL (http://localhost:3000), NEXT_PUBLIC_APP_NAME.
  4. backend/.env → FIREBASE_PROJECT_ID=<same id>; .firebaserc → "default": same id.
  5. Emulator toggles (restart dev after changing):
       Local Docker emulators:
         frontend/.env.local  NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true
         backend/.env         USE_EMULATOR=true
       Real Firebase instead:
         NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false (or delete line)
         USE_EMULATOR=false
     Keep FIRESTORE_EMULATOR_HOST=localhost:8080 and FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
     when USE_EMULATOR=true (defaults in backend/.env.example).
  6. pnpm run dev  →  http://localhost:3000   |   Emulator UI  →  http://localhost:4000

  Full env tables: README.md → "What to put in your env files"
  Reference list: docs/ENV-VARS.md
`)
