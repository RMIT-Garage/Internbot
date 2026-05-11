# Firebase Web App + Secret Manager export of its SDK config.
#
# Why this module exists:
#   The frontend's `NEXT_PUBLIC_FIREBASE_*` values (apiKey, appId, sender ID,
#   etc.) are per-env and are awkward to commit. Historically we stashed them
#   in GitHub repo variables, which created drift between environments and
#   forced humans to copy-paste from the Firebase Console.
#
#   This module provisions the web app via Terraform, reads the SDK config
#   via the canonical data source, packs it into a single JSON secret named
#   `firebase-web-config`, and grants the deploy SA `secretAccessor` only on
#   that one secret. The deploy workflow fetches the secret at build time
#   and unpacks the JSON into NEXT_PUBLIC_* env vars — no GitHub variables,
#   no manual hand-off.
#
# Bootstrap notes:
#   - Fresh project (e.g. prod): Terraform creates the web app cleanly.
#   - Existing project that already has a web app (e.g. the dev project that
#     was set up via the Firebase Console): import once with
#       terraform import 'module.web_app.google_firebase_web_app.default' \
#         projects/<project>/webApps/<appId>
#     then apply normally.

resource "google_firebase_web_app" "default" {
  provider     = google-beta
  project      = var.project_id
  display_name = var.display_name

  # The Firebase Console mutates display_name and adds an api_key_id over
  # the lifetime of an app. Ignore those so re-applies don't churn.
  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      display_name,
      api_key_id,
    ]
  }
}

data "google_firebase_web_app_config" "default" {
  provider   = google-beta
  project    = var.project_id
  web_app_id = google_firebase_web_app.default.app_id
}

# One secret per env, same name everywhere — `firebase-web-config`. The CI
# workflow doesn't have to know per-env names; it just authenticates to the
# right project and fetches by this fixed name.
resource "google_secret_manager_secret" "firebase_web_config" {
  project   = var.project_id
  secret_id = "firebase-web-config"

  replication {
    auto {}
  }

  labels = {
    managed-by = "terraform"
    surface    = "frontend-build"
  }
}

# JSON shape — matches the keys the frontend build step expects. apiUrl and
# appUrl are derived here so the workflow doesn't need to know them either;
# they live alongside the SDK values for a single-fetch surface.
locals {
  # Keys here must match the `NEXT_PUBLIC_FIREBASE_*` set the frontend
  # actually reads — kept symmetric with `_deploy-hosting.yml`. Add
  # `measurementId` here only if/when Firebase Analytics is wired up.
  web_config_json = jsonencode({
    apiKey            = data.google_firebase_web_app_config.default.api_key
    authDomain        = data.google_firebase_web_app_config.default.auth_domain
    projectId         = var.project_id
    storageBucket     = var.storage_bucket
    messagingSenderId = data.google_firebase_web_app_config.default.messaging_sender_id
    appId             = google_firebase_web_app.default.app_id
    apiUrl            = "https://${var.hosting_site_id}.web.app"
    appUrl            = "https://${var.hosting_site_id}.web.app"
  })
}

resource "google_secret_manager_secret_version" "firebase_web_config" {
  secret      = google_secret_manager_secret.firebase_web_config.id
  secret_data = local.web_config_json

  # Drop superseded versions so the project doesn't accumulate stale config.
  deletion_policy = "DELETE"
}

# Per-secret access for the deploy SA. Avoids granting project-wide
# secretAccessor — least privilege, and keeps the role surface auditable.
resource "google_secret_manager_secret_iam_member" "deploy_accessor" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.firebase_web_config.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.deploy_service_account_email}"
}
