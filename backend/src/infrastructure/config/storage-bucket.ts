/**
 * Resolve the Cloud Storage bucket name for the current Firebase project.
 *
 * Convention (matches Terraform `infrastructure/modules/storage/main.tf`):
 *   `${projectId}-storage` — plain bucket name, no `.appspot.com` suffix.
 *
 * Resolution order:
 *   1. `FIREBASE_STORAGE_BUCKET` (explicit override)
 *   2. `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (shared with the frontend bundle)
 *   3. `${projectId}-storage` derived from any of the standard Firebase /
 *      gcloud project env vars
 *
 * Both the Admin SDK (`firebase-admin.ts`) and the v2 storage trigger
 * registration (`backend/src/index.ts`) call this. The trigger needs an
 * explicit `bucket` because the project's bucket is not the conventional
 * `<project>.appspot.com`, so Firebase CLI's "default bucket" auto-discovery
 * fails at deploy time with `Can't find the storage bucket region`.
 */
export function resolveProjectId(): string | undefined {
  return (
    process.env['FIREBASE_PROJECT_ID'] ??
    process.env['GOOGLE_CLOUD_PROJECT'] ??
    process.env['GCLOUD_PROJECT']
  )
}

export function resolveStorageBucket(): string | undefined {
  const explicit =
    process.env['FIREBASE_STORAGE_BUCKET'] ?? process.env['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET']
  if (explicit) return explicit
  const projectId = resolveProjectId()
  return projectId ? `${projectId}-storage` : undefined
}
