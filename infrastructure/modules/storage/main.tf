locals {
  # Plain bucket name — avoids GCS's domain-ownership check that fires when a
  # bucket name contains a TLD (e.g. .appspot.com, .firebasestorage.app).
  # Firebase Storage SDKs work fine with any bucket name; the frontend just
  # needs to reference it via NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.
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
