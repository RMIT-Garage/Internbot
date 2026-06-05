#!/usr/bin/env node
/**
 * Grant { admin: true } to every user in the Firebase Auth emulator.
 * Run from repo root: node scripts/grant-admin-emulator.cjs
 */
'use strict'

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const backendRoot = path.join(root, 'backend')
const envPath = path.join(backendRoot, '.env')
if (!fs.existsSync(envPath)) {
  console.error('Missing backend/.env')
  process.exit(1)
}
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i === -1) continue
  const k = t.slice(0, i).trim()
  let v = t.slice(i + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!process.env[k]) process.env[k] = v
}

const projectId = process.env.FIREBASE_PROJECT_ID
if (!projectId) {
  console.error('FIREBASE_PROJECT_ID missing in backend/.env')
  process.exit(1)
}
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= 'localhost:9099'

const admin = require(path.join(backendRoot, 'node_modules', 'firebase-admin'))

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId })
}

;(async () => {
  const list = await admin.auth().listUsers()
  if (list.users.length === 0) {
    console.log('No users in Auth emulator. Register at http://localhost:3000/register then run this script again.')
    process.exit(0)
  }
  for (const u of list.users) {
    await admin.auth().setCustomUserClaims(u.uid, { admin: true })
    console.log('admin: true →', u.email || u.uid)
  }
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
