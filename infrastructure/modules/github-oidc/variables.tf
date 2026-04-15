variable "project_id" {
  description = "GCP project ID where the WIF pool and deploy SA live"
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
  description = "Git refs allowed to impersonate the deploy SA. Empty list = any ref."
  type        = list(string)
  default     = []
}

variable "deploy_sa_roles" {
  description = "IAM roles granted to the github-deploy service account"
  type        = list(string)
}
