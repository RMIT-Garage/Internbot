import { onRequest } from 'firebase-functions/v2/https'
import { beforeUserCreated, HttpsError } from 'firebase-functions/v2/identity'
import { onObjectFinalized } from 'firebase-functions/v2/storage'
import type { BlockingFunction } from 'firebase-functions/v1'
import { createApp } from './api/app'
import { SyncStorageAttachmentCommandHandler } from './application/commands/sync-storage-attachment'
import { resolveStorageBucket } from './infrastructure/config/storage-bucket'
import { firestoreUnitOfWork } from './infrastructure/firestore/firestore-unit-of-work'
import { gcsAttachmentStorage } from './infrastructure/storage/gcs-attachment-storage'
import { SyncAttachmentMetadataWorker } from './workers/sync-attachment-metadata'

const app = createApp()
const syncAttachmentMetadataWorker = new SyncAttachmentMetadataWorker(
  new SyncStorageAttachmentCommandHandler(firestoreUnitOfWork, gcsAttachmentStorage)
)

// Resolved at deploy parse time. The Firebase CLI loads this module to
// discover function configs before uploading; if `bucket` is omitted the CLI
// tries to auto-discover the project's "default" bucket (`<project>.appspot.com`
// / `.firebasestorage.app`), which doesn't exist for this project — Terraform
// provisions a plain `<project_id>-storage` bucket instead. Without the
// explicit bucket the deploy fails with `Can't find the storage bucket region`.
const STORAGE_BUCKET = resolveStorageBucket()
if (!STORAGE_BUCKET) {
  throw new Error(
    'Could not resolve storage bucket: set FIREBASE_STORAGE_BUCKET, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, or one of FIREBASE_PROJECT_ID / GOOGLE_CLOUD_PROJECT / GCLOUD_PROJECT.'
  )
}

/**
 * Main API Cloud Function — Express fat-lambda pattern.
 * All routes are handled by the Express app.
 *
 * Deployed URL: https://{region}-{project}.cloudfunctions.net/api
 */
export const api = onRequest(
  {
    region: 'australia-southeast1',
    maxInstances: 10,
    memory: '256MiB',
    timeoutSeconds: 60,
    // Public REST API — anyone can hit endpoints. Auth happens at the
    // application layer via authMiddleware (Firebase ID token verification).
    invoker: 'public',
    cors: true,
  },
  app
)

/**
 * Cloud Storage finalize trigger — synchronizes trusted attachment metadata
 * into Firestore after the frontend uploads directly to Storage.
 *
 * Flow: Storage rules gate the upload (only the owning student or the
 * opportunity creator/submitter can write under the expected prefix). Cloud
 * Storage emits OBJECT_FINALIZE, Eventarc delivers it, this function parses
 * the path and validates the parent + ownership invariants, then writes the
 * Firestore attachment doc.
 *
 * `retry: true` opts the underlying Eventarc subscription into retry-on-error
 * (default Pub/Sub backoff, 7-day TTL). Transient Firestore / Storage failures
 * propagate as exceptions and are redelivered; deterministic logical failures
 * (invalid path, parent missing) are absorbed inside the handler so they do
 * not loop.
 */
export const syncAttachmentMetadata = onObjectFinalized(
  {
    bucket: STORAGE_BUCKET,
    region: 'australia-southeast1',
    maxInstances: 10,
    memory: '256MiB',
    timeoutSeconds: 60,
    retry: true,
  },
  (event) => syncAttachmentMetadataWorker.handle(event)
)

/**
 * Identity Platform `beforeCreate` blocking function — rejects sign-ups whose
 * email is not an RMIT student email. This is the *only* trustworthy place
 * to enforce the email-domain policy: client SDK validation can be bypassed
 * and any backend post-create derivation runs after the auth user already
 * exists.
 *
 * Wired to GCIP via `infrastructure/modules/auth/main.tf`. The Terraform
 * module reads the deployed function URL through a
 * `google_cloudfunctions2_function` data source — no manual URL hand-off.
 *
 * Bootstrap on a new environment (one-time):
 *   1. `terraform apply` with `wire_blocking_function = false` (upgrades
 *      the project to Identity Platform; trigger unwired).
 *   2. `firebase deploy --only functions:enforceStudentEmail`.
 *   3. Flip `wire_blocking_function = true` in env tfvars; `terraform apply`.
 *
 * Steady state: every push to develop/main re-runs Terraform then deploys
 * the function. The deterministic `cloudfunctions.net` URL is stable so
 * Terraform sees no diff after bootstrap.
 */
const STUDENT_EMAIL_REGEX = /^s\d+@student\.rmit\.edu\.au$/i

export const enforceStudentEmail: BlockingFunction = beforeUserCreated(
  { region: 'australia-southeast1' },
  (event) => {
    const email = event.data?.email
    if (!email || !STUDENT_EMAIL_REGEX.test(email)) {
      throw new HttpsError(
        'invalid-argument',
        'Sign-up requires an RMIT student email (e.g. s1234567@student.rmit.edu.au).'
      )
    }
  }
)

/**
 * Why no `beforeUserSignedIn` blocking function?
 *
 * `createUserWithEmailAndPassword` performs an implicit sign-in immediately
 * after create. A `beforeSignIn` trigger that gates on `emailVerified` would
 * reject that sign-in (a fresh user is unverified by definition), the SDK
 * never populates `auth.currentUser`, and the frontend has no way to call
 * `sendEmailVerification(user)` — the user is locked out before the email
 * is ever sent. Working around it requires a backend email service and
 * custom sign-up endpoint, which is not worth the marginal security gain:
 * unverified tokens are already inert in our system.
 *
 * Defense-in-depth lives in two places instead:
 *   - `firebase-token-verifier.ts` — rejects any decoded token whose
 *     `email_verified` claim is not true.
 *   - `platform-user-hydrator.ts` — refuses to JIT-create a `users/{id}`
 *     document for an unverified email, preventing student-number squatting.
 *
 * An attacker holding an unverified token therefore has zero API surface:
 * no platform identity, no Firestore writes, no Storage access.
 */
