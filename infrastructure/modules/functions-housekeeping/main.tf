# Artifact Registry repo for Cloud Functions v2 container images.
# Firebase deploy auto-creates this on first run, but managing it via Terraform
# lets us own the cleanup_policies (otherwise images accumulate forever).
# For an existing project where Firebase already created it, import first:
#   terraform import module.functions_housekeeping.google_artifact_registry_repository.gcf_artifacts \
#     projects/PROJECT_ID/locations/REGION/repositories/gcf-artifacts
resource "google_artifact_registry_repository" "gcf_artifacts" {
  project       = var.project_id
  location      = var.region
  repository_id = "gcf-artifacts"
  format        = "DOCKER"
  description   = "Cloud Functions v2 container images. Cleanup policies managed by Terraform."

  cleanup_policies {
    id     = "keep-latest-5"
    action = "KEEP"
    most_recent_versions {
      keep_count = 5
    }
  }

  cleanup_policies {
    id     = "delete-older-than-30d"
    action = "DELETE"
    condition {
      older_than = "2592000s" # 30 days
    }
  }

  lifecycle {
    prevent_destroy = true
    # Firebase may set labels on the auto-created repo; don't fight it.
    ignore_changes = [labels, kms_key_name]
  }
}

# Allow the Cloud Functions v2 runtime SA to mint V4 signed URLs by
# self-impersonating to call `iam.serviceAccounts.signBlob`. The
# `@google-cloud/storage` signer calls `signBlob` against the runtime
# identity whenever `getSignedUrl(...)` runs without a pre-loaded private
# key (the default on Cloud Run / Cloud Functions v2). Without this
# binding, attachment upload-intent endpoints throw:
#
#   SigningError: Permission 'iam.serviceAccounts.signBlob' denied on
#   resource (or it may not exist).
#
# We don't set a custom service account on the `api` function, so it
# defaults to the project's Compute Engine default SA. Granting the role
# on the SA-as-resource (self-binding) keeps the blast radius scoped to
# that SA rather than project-wide.
resource "google_service_account_iam_member" "runtime_self_sign_blob" {
  service_account_id = "projects/${var.project_id}/serviceAccounts/${var.project_number}-compute@developer.gserviceaccount.com"
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${var.project_number}-compute@developer.gserviceaccount.com"
}

# Cloud Functions v2 uploads source ZIPs to gcf-v2-sources-<NUM>-<REGION>.
# Each deploy creates a new object; without a lifecycle rule they pile up.
resource "google_storage_bucket" "gcf_sources" {
  project                     = var.project_id
  name                        = "gcf-v2-sources-${var.project_number}-${var.region}"
  location                    = upper(var.region)
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  force_destroy               = false

  lifecycle_rule {
    condition {
      age = 7
    }
    action {
      type = "Delete"
    }
  }

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [labels, requester_pays]
  }
}
