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

  depends_on = [module.firebase_project]
}

module "storage" {
  source     = "./modules/storage"
  project_id = var.project_id
  location   = var.region

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

module "functions_housekeeping" {
  source         = "./modules/functions-housekeeping"
  project_id     = var.project_id
  project_number = data.google_project.this.number
  region         = var.region

  depends_on = [module.firebase_project]
}

module "app_hosting" {
  source            = "./modules/app-hosting"
  project_id        = var.project_id
  backend_id        = var.apphosting_backend_id
  display_name      = var.apphosting_display_name
  environment       = var.apphosting_environment
  location          = var.apphosting_location
  github_repository = var.github_repository
  live_branch       = var.apphosting_live_branch
  root_directory    = var.apphosting_root_directory

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
