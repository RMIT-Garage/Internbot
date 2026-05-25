#!/usr/bin/env tsx
/**
 * One-time migration: `semesters` documents with `status: 'active'` →
 * `status: 'enrollment_open'` + `_schemaVersion: 2`.
 *
 * Run once immediately after deploying the backend that expands
 * SemesterStatus. Until this runs, Firestore list queries that filter on
 * `status == 'enrollment_open'` miss legacy documents.
 *
 * Safety:
 *   - Dry-run by default; pass --commit to write.
 *   - Never touches documents whose `status` is not `'active'`.
 *   - Uses batched writes (max 500 per batch) for atomicity.
 *
 * Usage:
 *   pnpm tsx backend/scripts/migrate-semester-status.ts            # dry-run
 *   pnpm tsx backend/scripts/migrate-semester-status.ts --commit   # write
 *
 * Required env: GOOGLE_APPLICATION_CREDENTIALS or application default creds.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const COMMIT = process.argv.includes('--commit')

if (!getApps().length) {
  initializeApp(
    process.env['GOOGLE_APPLICATION_CREDENTIALS']
      ? { credential: cert(process.env['GOOGLE_APPLICATION_CREDENTIALS']) }
      : undefined
  )
}

const db = getFirestore()

async function run(): Promise<void> {
  console.log(`Mode: ${COMMIT ? 'COMMIT' : 'DRY-RUN'}`)

  const snapshot = await db.collection('semesters').where('status', '==', 'active').get()

  if (snapshot.empty) {
    console.log('No legacy semesters found. Nothing to migrate.')
    return
  }

  console.log(`Found ${snapshot.size} semester(s) with status='active'.`)

  const BATCH_SIZE = 400
  let migrated = 0

  for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
    const chunk = snapshot.docs.slice(i, i + BATCH_SIZE)
    if (COMMIT) {
      const batch = db.batch()
      for (const doc of chunk) {
        batch.update(doc.ref, { status: 'enrollment_open', _schemaVersion: 2 })
        console.log(`  [update] semesters/${doc.id} → enrollment_open`)
      }
      await batch.commit()
    } else {
      for (const doc of chunk) {
        console.log(`  [dry-run] would update semesters/${doc.id} → enrollment_open`)
      }
    }
    migrated += chunk.length
  }

  console.log(`\nDone. ${COMMIT ? 'Migrated' : 'Would migrate'} ${migrated} document(s).`)
  if (!COMMIT) {
    console.log('Re-run with --commit to apply changes.')
  }
}

run().catch((err: unknown) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
