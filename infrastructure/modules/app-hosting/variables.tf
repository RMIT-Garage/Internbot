variable "project_id" {
  description = "Firebase project ID"
  type        = string
}

variable "backend_id" {
  description = "Firebase App Hosting backend ID"
  type        = string
}

variable "display_name" {
  description = "Human-readable display name for the Firebase Web App and App Hosting backend"
  type        = string
}

variable "environment" {
  description = "App Hosting environment name used for environment-specific apphosting config"
  type        = string
}

variable "location" {
  description = "Firebase App Hosting and Developer Connect location"
  type        = string
}

variable "github_repository" {
  description = "GitHub repository in owner/name form"
  type        = string
}

variable "live_branch" {
  description = "Branch associated with this App Hosting backend"
  type        = string
}

variable "root_directory" {
  description = "Directory containing the Next.js app, relative to the repository root"
  type        = string
  default     = "frontend"
}
