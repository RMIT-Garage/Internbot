variable "project_id" {
  description = "GCP project ID where the WIF pool and SAs live"
  type        = string
}

variable "github_repository" {
  description = "GitHub repository in owner/name form (e.g. giatinhuynh/Internbot)"
  type        = string
}

variable "github_repository_id" {
  description = "Immutable GitHub repository ID (numeric)"
  type        = string
}

variable "allowed_refs" {
  description = "Git refs allowed to impersonate the deploy (write) SA. Empty list = any ref in the repo."
  type        = list(string)
  default     = []
}

variable "deploy_sa_roles" {
  description = "IAM roles granted to the github-deploy (write) service account"
  type        = list(string)
}

variable "planner_sa_roles" {
  description = "IAM roles granted to the github-planner (read-only) service account used by terraform plan on PR workflows"
  type        = list(string)
  default = [
    "roles/viewer",
    "roles/iam.securityReviewer",
    # Lets the SA honour the google provider's billing_project + user_project_override
    # so API quota billing routes to this project (not Google's default).
    "roles/serviceusage.serviceUsageConsumer",
    # Read access to Firebase Rules + broader Firebase metadata — Terraform plan
    # reads rulesets + releases + project-wide Firebase config.
    "roles/firebaserules.viewer",
    "roles/firebase.viewer",
  ]
}
