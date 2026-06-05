terraform {
  required_version = ">= 1.10"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 6.0"
    }
  }

  # Remote state — replace with your GCS bucket or Terraform Cloud workspace
  # backend "gcs" {
  #   bucket = "YOUR_PROJECT_ID-terraform-state"
  #   prefix = "terraform/state"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# ── Firebase Project ──────────────────────────────────────────────────────────

resource "google_firebase_project" "default" {
  provider = google-beta
  project  = var.project_id
}

# ── Firestore ─────────────────────────────────────────────────────────────────

resource "google_firestore_database" "default" {
  provider                    = google-beta
  project                     = var.project_id
  name                        = "(default)"
  location_id                 = var.firestore_location
  type                        = "FIRESTORE_NATIVE"
  concurrency_mode            = "OPTIMISTIC"
  app_engine_integration_mode = "DISABLED"

  depends_on = [google_firebase_project.default]
}

# ── Firebase Auth ─────────────────────────────────────────────────────────────

resource "google_identity_platform_config" "default" {
  provider = google-beta
  project  = var.project_id

  sign_in {
    allow_duplicate_emails = false

    email {
      enabled           = true
      password_required = true
    }

    anonymous {
      enabled = false
    }
  }

  depends_on = [google_firebase_project.default]
}

# ── Cloud Storage ─────────────────────────────────────────────────────────────

resource "google_firebase_storage_bucket" "default" {
  provider  = google-beta
  project   = var.project_id
  bucket_id = "${var.project_id}.appspot.com"

  depends_on = [google_firebase_project.default]
}

# ── Firebase App Hosting (Frontend) ──────────────────────────────────────────

resource "google_firebase_app_hosting_backend" "frontend" {
  provider   = google-beta
  project    = var.project_id
  location   = var.region
  backend_id = "frontend"

  serving_locality = "GLOBAL_ACCESS"

  app_association {
    association = "FIREBASE"
  }

  depends_on = [google_firebase_project.default]
}
