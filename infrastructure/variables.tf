variable "project_id" {
  description = "The GCP/Firebase project ID"
  type        = string
}

variable "region" {
  description = "The GCP region for Cloud Functions"
  type        = string
  default     = "australia-southeast1"
}

variable "firestore_location" {
  description = "The Firestore database location"
  type        = string
  default     = "australia-southeast2"
}

variable "state_bucket" {
  description = "GCS bucket holding Terraform remote state. Used to grant planner SA read access."
  type        = string
}

variable "billing_account" {
  description = "Billing account ID (e.g. 0161F5-9777AE-74E102) — used for budget alerts."
  type        = string
}

variable "monthly_budget_amount" {
  description = "Monthly budget amount (in budget_currency). Triggers alert at 50/90/100% spend."
  type        = number
  default     = 1
}

variable "budget_currency" {
  description = "Budget currency code (ISO 4217)"
  type        = string
  default     = "AUD"
}

variable "github_repository" {
  description = "GitHub repository in owner/name form (e.g. giatinhuynh/Internbot)"
  type        = string
}

variable "github_repository_id" {
  description = "Immutable GitHub repository ID (numeric). Find via `gh api repos/OWNER/REPO --jq .id`"
  type        = string
}

variable "github_allowed_refs" {
  description = "List of git refs (e.g. 'refs/heads/main') allowed to impersonate the deploy SA. Empty = any ref."
  type        = list(string)
  default     = []
}

variable "deploy_sa_roles" {
  description = "IAM roles granted to the github-deploy service account"
  type        = list(string)
  default = [
    "roles/firebase.admin",
    "roles/cloudfunctions.admin",
    "roles/artifactregistry.writer",
    "roles/iam.serviceAccountUser",
    "roles/run.admin",
    "roles/serviceusage.serviceUsageConsumer",
  ]
}
