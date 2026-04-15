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
