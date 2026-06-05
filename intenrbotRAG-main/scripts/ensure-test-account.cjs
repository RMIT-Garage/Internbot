#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const backendRoot = path.join(root, 'backend')
const envPath = path.join(backendRoot, '.env')

function loadBackendEnv() {
  if (!fs.existsSync(envPath)) return
  const text = fs.readFileSync(envPath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx <= 0) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

async function main() {
  loadBackendEnv()

  const projectId = process.env.FIREBASE_PROJECT_ID
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID missing (backend/.env)')

  process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099'

  const admin = require(path.join(backendRoot, 'node_modules', 'firebase-admin'))
  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId })
  }

  const email = process.env.TEST_ACCOUNT_EMAIL || 'test@interbotrag.local'
  const password = process.env.TEST_ACCOUNT_PASSWORD || 'Test1234!'
  const displayName = process.env.TEST_ACCOUNT_NAME || 'Test Account'

  let user
  try {
    user = await admin.auth().getUserByEmail(email)
    user = await admin.auth().updateUser(user.uid, { password, displayName, disabled: false, emailVerified: true })
  } catch (error) {
    if (error && error.code === 'auth/user-not-found') {
      user = await admin.auth().createUser({ email, password, displayName, emailVerified: true })
    } else {
      throw error
    }
  }

  await admin.auth().setCustomUserClaims(user.uid, { admin: true })
  console.log('Ready test account:')
  console.log(`  email: ${email}`)
  console.log(`  password: ${password}`)
  console.log('  claims: { admin: true }')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
