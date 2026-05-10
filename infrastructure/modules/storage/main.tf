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

# Mint the GCS service agent (lazy until first reference). The agent
# publishes OBJECT_FINALIZE events to the Pub/Sub topic Eventarc creates
# behind each storage trigger.
resource "google_project_service_identity" "gcs" {
  provider = google-beta
  project  = var.project_id
  service  = "storage.googleapis.com"
}

resource "google_project_iam_member" "gcs_pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_project_service_identity.gcs.email}"
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
