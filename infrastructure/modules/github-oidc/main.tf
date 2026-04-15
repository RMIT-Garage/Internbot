data "google_project" "this" {
  project_id = var.project_id
}

# Workload Identity Pool + Provider.
# Provider-level condition: only require repo match. Per-SA ref restrictions
# live on the principalSet member format (attribute.ref/...) so the loose
# provider condition lets PR workflows authenticate (for plan) while write
# SAs are still locked to specific branches.
resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "github"
  display_name              = "GitHub Actions"
  description               = "OIDC pool for GitHub Actions workflows"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub Provider"

  attribute_mapping = {
    "google.subject"             = "assertion.sub"
    "attribute.repository"       = "assertion.repository"
    "attribute.repository_id"    = "assertion.repository_id"
    "attribute.repository_owner" = "assertion.repository_owner"
    "attribute.ref"              = "assertion.ref"
  }

  # Only this repo can authenticate. Per-ref restriction moves to SA bindings.
  attribute_condition = "assertion.repository_id == '${var.github_repository_id}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# --- Deploy SA (write): locked to specific refs via principalSet. -------------

resource "google_service_account" "deploy" {
  project      = var.project_id
  account_id   = "github-deploy"
  display_name = "GitHub Actions Deploy"
  description  = "Impersonated by GitHub Actions via OIDC to deploy application code"
}

resource "google_project_iam_member" "deploy_roles" {
  for_each = toset(var.deploy_sa_roles)

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# Ref-scoped WIF bindings for the deploy SA. One binding per allowed ref —
# if allowed_refs = ["refs/heads/main"], only pushes to main can impersonate.
# If allowed_refs is empty, falls back to a repo-level binding (any ref).
resource "google_service_account_iam_member" "deploy_wif_binding_ref" {
  for_each = toset(var.allowed_refs)

  service_account_id = google_service_account.deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/projects/${data.google_project.this.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github.workload_identity_pool_id}/attribute.ref/${each.value}"
}

resource "google_service_account_iam_member" "deploy_wif_binding_repo" {
  count = length(var.allowed_refs) == 0 ? 1 : 0

  service_account_id = google_service_account.deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/projects/${data.google_project.this.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github.workload_identity_pool_id}/attribute.repository/${var.github_repository}"
}

# --- Planner SA (read-only): loose WIF binding, any ref from this repo. ------
# Used by terraform plan on PR workflows where ref=refs/pull/N/merge. Read-only
# roles so a compromised PR branch can't mutate state.

resource "google_service_account" "planner" {
  project      = var.project_id
  account_id   = "github-planner"
  display_name = "GitHub Actions Planner"
  description  = "Read-only SA for terraform plan on PR workflows. Any ref in the repo can impersonate."
}

resource "google_project_iam_member" "planner_roles" {
  for_each = toset(var.planner_sa_roles)

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.planner.email}"
}

resource "google_service_account_iam_member" "planner_wif_binding" {
  for_each = toset([
    "roles/iam.workloadIdentityUser",
    "roles/iam.serviceAccountTokenCreator",
  ])

  service_account_id = google_service_account.planner.name
  role               = each.value
  member             = "principalSet://iam.googleapis.com/projects/${data.google_project.this.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github.workload_identity_pool_id}/attribute.repository/${var.github_repository}"
}
