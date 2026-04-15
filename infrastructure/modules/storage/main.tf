locals {
  # Firebase convention: storage bucket follows `{project-id}.appspot.com`.
  # Firebase Storage wraps a regular GCS bucket — both must exist.
  bucket_name = "${var.project_id}.appspot.com"
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
