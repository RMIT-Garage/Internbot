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

  # Partial backend config — bucket is passed per-env via `-backend-config`
  # e.g. terraform init -backend-config=dev.backend.hcl
  backend "gcs" {
    prefix = "terraform/state"
  }
}

provider "google" {
  project               = var.project_id
  region                = var.region
  user_project_override = true
  billing_project       = var.project_id
}

provider "google-beta" {
  project               = var.project_id
  region                = var.region
  user_project_override = true
  billing_project       = var.project_id
}

module "firebase_project" {
  source     = "./modules/firebase-project"
  project_id = var.project_id
}

module "firestore" {
  source             = "./modules/firestore"
  project_id         = var.project_id
  firestore_location = var.firestore_location

  depends_on = [module.firebase_project]
}

module "auth" {
  source     = "./modules/auth"
  project_id = var.project_id
  region     = var.region

  # GCIP beforeCreate blocking function — gates Firebase Auth sign-ups at the
  # IdP layer. Leave `false` on first apply (default); deploy the function
  # with `firebase deploy --only functions:enforceStudentEmail`, then flip
  # to `true` in the env tfvars and re-apply. Terraform discovers the
  # function URL via a data source, so no manual URL hand-off.
  wire_blocking_function = var.wire_blocking_function

  # Authorized domains for Firebase Auth. `localhost` plus the standard
  # firebaseapp.com / web.app domains are always included; pass extras here.
  extra_authorized_domains = var.extra_authorized_domains

  depends_on = [module.firebase_project]
}

module "storage" {
  source     = "./modules/storage"
  project_id = var.project_id
  location   = var.region

  depends_on = [module.firebase_project]
}

# Cross-service Firestore lookup for Storage rules. Only the `users/{id}/avatar/**`
# path still uses `firestore.get(userIdentities/...)` — attachment uploads now
# go through the backend intent endpoint + V4 signed PUT URL instead, with no
# Storage rule evaluation. If avatars also migrate to the signed-URL flow, this
# grant can go away entirely.
resource "google_project_iam_member" "firebase_rules_firestore_cross_service" {
  project = var.project_id
  role    = "roles/firebaserules.firestoreServiceAgent"
  member  = "serviceAccount:service-${data.google_project.this.number}@firebase-rules.iam.gserviceaccount.com"

  depends_on = [
    module.firebase_project,
    module.firestore,
    module.storage,
  ]
}

module "hosting" {
  source     = "./modules/hosting"
  project_id = var.project_id

  depends_on = [module.firebase_project]
}

module "github_oidc" {
  source               = "./modules/github-oidc"
  project_id           = var.project_id
  github_repository    = var.github_repository
  github_repository_id = var.github_repository_id
  allowed_refs         = var.github_allowed_refs
  deploy_sa_roles      = var.deploy_sa_roles

  depends_on = [module.firebase_project]
}

# Firebase Web App + Secret Manager export of its SDK config.
# The deploy workflow fetches `firebase-web-config` at build time and
# unpacks it into NEXT_PUBLIC_* env vars — no GitHub repo variables.
# See infrastructure/modules/web-app/main.tf for the bootstrap dance on
# projects that already have a Firebase Web App (terraform import).
module "web_app" {
  source                       = "./modules/web-app"
  project_id                   = var.project_id
  storage_bucket               = module.storage.bucket_name
  hosting_site_id              = module.hosting.site_id
  deploy_service_account_email = module.github_oidc.deploy_service_account

  depends_on = [
    module.firebase_project,
    module.storage,
    module.hosting,
    module.github_oidc,
  ]
}

module "functions_housekeeping" {
  source         = "./modules/functions-housekeeping"
  project_id     = var.project_id
  project_number = data.google_project.this.number
  region         = var.region

  depends_on = [module.firebase_project]
}

# Read-only access for the planner SA on the Terraform state bucket.
# Lets `terraform plan` on PR workflows read state without write perms.
resource "google_storage_bucket_iam_member" "planner_state_read" {
  bucket = var.state_bucket
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${module.github_oidc.planner_service_account}"
}

# Monthly budget alert on the project. Triggers email at 50/90/100% of budget.
data "google_project" "this" {
  project_id = var.project_id
}

resource "google_billing_budget" "default" {
  billing_account = var.billing_account
  display_name    = "Firebase Project ${var.project_id}"

  budget_filter {
    projects               = ["projects/${data.google_project.this.number}"]
    calendar_period        = "MONTH"
    credit_types_treatment = "INCLUDE_ALL_CREDITS"
  }

  amount {
    specified_amount {
      currency_code = var.budget_currency
      units         = tostring(var.monthly_budget_amount)
    }
  }

  threshold_rules {
    threshold_percent = 0.5
  }
  threshold_rules {
    threshold_percent = 0.9
  }
  threshold_rules {
    threshold_percent = 1.0
  }
}

# Note: Cloud Function invoker IAM is declared in backend/src/index.ts via
# `invoker: 'public'` on the onRequest options. Firebase deploy applies it as
# part of the deploy. Keeping it in code (not Terraform) avoids the race where
# the Cloud Run service doesn't exist yet on first apply for a fresh project.
