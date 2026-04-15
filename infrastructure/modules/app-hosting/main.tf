resource "google_firebase_web_app" "frontend" {
  provider = google-beta

  project         = var.project_id
  display_name    = var.display_name
  deletion_policy = "ABANDON"
}

resource "google_service_account" "compute" {
  provider = google-beta

  project                      = var.project_id
  account_id                   = "firebase-app-hosting-compute"
  display_name                 = "Firebase App Hosting compute"
  description                  = "Runs Firebase App Hosting builds and Cloud Run services"
  create_ignore_already_exists = true
}

resource "google_project_iam_member" "compute_roles" {
  provider = google-beta
  for_each = toset([
    "roles/developerconnect.readTokenAccessor",
    "roles/firebase.sdkAdminServiceAgent",
    "roles/firebaseapphosting.computeRunner",
  ])

  project = var.project_id
  role    = each.value
  member  = google_service_account.compute.member
}

resource "google_project_service_identity" "developer_connect" {
  provider = google-beta

  project = var.project_id
  service = "developerconnect.googleapis.com"
}

resource "google_project_iam_member" "developer_connect_secret_admin" {
  provider = google-beta

  project = var.project_id
  role    = "roles/secretmanager.admin"
  member  = google_project_service_identity.developer_connect.member
}

resource "google_developer_connect_connection" "github" {
  provider = google-beta

  project       = var.project_id
  location      = var.location
  connection_id = "firebase-app-hosting-github-oauth"

  github_config {
    github_app = "FIREBASE"
  }

  depends_on = [google_project_iam_member.developer_connect_secret_admin]
}

resource "google_developer_connect_git_repository_link" "repo" {
  provider = google-beta

  project                = var.project_id
  location               = var.location
  parent_connection      = google_developer_connect_connection.github.connection_id
  git_repository_link_id = "internbot"
  clone_uri              = "https://github.com/${var.github_repository}.git"
}

resource "google_firebase_app_hosting_backend" "frontend" {
  provider = google-beta

  project          = var.project_id
  location         = var.location
  backend_id       = var.backend_id
  display_name     = var.display_name
  app_id           = google_firebase_web_app.frontend.app_id
  service_account  = google_service_account.compute.email
  serving_locality = "GLOBAL_ACCESS"
  environment      = var.environment

  codebase {
    repository     = google_developer_connect_git_repository_link.repo.name
    root_directory = var.root_directory
  }

  depends_on = [google_project_iam_member.compute_roles]
}

resource "google_firebase_app_hosting_traffic" "frontend" {
  provider = google-beta

  project  = var.project_id
  location = google_firebase_app_hosting_backend.frontend.location
  backend  = google_firebase_app_hosting_backend.frontend.backend_id

  rollout_policy {
    codebase_branch = var.live_branch
    disabled        = true
  }
}
