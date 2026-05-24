locals {
  # Plain bucket name avoids GCS's domain-ownership check that fires when a
  # bucket name contains a TLD (e.g. .appspot.com, .firebasestorage.app).
  # Firebase Storage SDKs work fine with any bucket name; the frontend just
  # references it via NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.
  bucket_name = "${var.project_id}-storage"
}

resource "google_storage_bucket" "default" {
  project                     = var.project_id
  name                        = local.bucket_name
  location                    = var.location
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  force_destroy               = false

  versioning {
    enabled = false
  }

  # Required for browser-side direct uploads via V4 signed PUT URLs.
  # Without this, browsers block the cross-origin PUT to storage.googleapis.com
  # regardless of the signed URL's own auth credentials.
  cors {
    origin          = ["*"]
    method          = ["GET", "PUT", "HEAD", "DELETE"]
    response_header = ["Content-Type", "Cache-Control"]
    max_age_seconds = 3600
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_firebase_storage_bucket" "default" {
  provider  = google-beta
  project   = var.project_id
  bucket_id = google_storage_bucket.default.id
}

# Storage security rules — managed via Terraform so they're drift-detected and
# deployed atomically. Avoids Firebase CLI's "Get Started" console requirement.
resource "google_firebaserules_ruleset" "storage" {
  provider = google-beta
  project  = var.project_id

  source {
    files {
      name    = "storage.rules"
      content = file("${path.module}/../../../docker/firebase-emulator/firebase/storage.rules")
    }
  }

  depends_on = [google_firebase_storage_bucket.default]
}

resource "google_firebaserules_release" "storage" {
  provider     = google-beta
  project      = var.project_id
  name         = "firebase.storage/${google_storage_bucket.default.name}"
  ruleset_name = "projects/${var.project_id}/rulesets/${google_firebaserules_ruleset.storage.name}"

  lifecycle {
    replace_triggered_by = [google_firebaserules_ruleset.storage]
  }
}

# Service-agent IAM bindings for the `syncAttachmentMetadata`
# `onObjectFinalized` trigger. Without these, `firebase deploy` creates the
# function but Eventarc trigger validation fails with:
#
#   Permission "storage.buckets.get" denied on
#   "Bucket internbot-dev-ae3a3-storage" ... that the Eventarc service
#   account has permission.
#
# Firebase CLI auto-grants project-level service-agent roles, but bucket-
# level reader on a non-default-named bucket (we use plain
# `${project_id}-storage`, not `<project>.appspot.com`) is on us.

# GCS service agent — `service-{PROJECT_NUMBER}@gs-project-accounts.iam.gserviceaccount.com`.
# Unlike Eventarc, `google_project_service_identity` returns null for
# `storage.googleapis.com`; the dedicated data source is the supported way
# to look up this agent's email. Touching the bucket once is enough to
# auto-provision it on the GCP side.
data "google_storage_project_service_account" "gcs" {
  project = var.project_id
}

resource "google_project_iam_member" "gcs_pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${data.google_storage_project_service_account.gcs.email_address}"
}

# Mint the Eventarc service agent so we can grant it bucket reader. Eventarc
# uses this identity to validate the trigger's bucket exists at create time.
resource "google_project_service_identity" "eventarc" {
  provider = google-beta
  project  = var.project_id
  service  = "eventarc.googleapis.com"
}

resource "google_storage_bucket_iam_member" "eventarc_bucket_reader" {
  bucket = google_storage_bucket.default.name
  role   = "roles/storage.legacyBucketReader"
  member = "serviceAccount:${google_project_service_identity.eventarc.email}"
}

# The Eventarc service agent also needs the Eventarc Service Agent role to
# validate triggers at create time. GCP normally auto-attaches this when the
# identity is minted, but propagation lags by minutes. On a project's first
# Eventarc deploy the out-of-band `firebase deploy` (a later CI job) races
# ahead of that propagation and fails the `syncAttachmentMetadata` trigger
# with: "Permission denied while using the Eventarc Service Agent ... verify
# that it has Eventarc Service Agent role". Grant it explicitly so the role
# exists deterministically rather than relying on the async auto-attach.
resource "google_project_iam_member" "eventarc_service_agent" {
  project = var.project_id
  role    = "roles/eventarc.serviceAgent"
  member  = "serviceAccount:${google_project_service_identity.eventarc.email}"
}

# Hold `terraform apply` open until the service-agent IAM grants above have
# had time to propagate. The prod `deploy-backend` job `needs: [terraform]`,
# so blocking here deterministically delays the `firebase deploy` that
# creates the Eventarc trigger. `time_sleep` sleeps only on create, so this
# costs the wait exactly once per project (the first apply that mints the
# agent), not on every subsequent apply.
resource "time_sleep" "eventarc_iam_propagation" {
  create_duration = "180s"

  triggers = {
    eventarc_sa = google_project_service_identity.eventarc.email
  }

  depends_on = [
    google_project_iam_member.eventarc_service_agent,
    google_storage_bucket_iam_member.eventarc_bucket_reader,
    google_project_iam_member.gcs_pubsub_publisher,
  ]
}
