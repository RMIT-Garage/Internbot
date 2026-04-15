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
