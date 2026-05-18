variable "project_id" {
  description = "Firebase project ID — also where the secret lives"
  type        = string
}

variable "display_name" {
  description = "Display name for the Firebase Web App in the console"
  type        = string
  default     = "Internbot Web"
}

variable "storage_bucket" {
  description = <<-EOT
    Storage bucket name baked into the SDK config.
    The hosting build references it as NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.
    Pass `module.storage.bucket_name` from the root module.
  EOT
  type        = string
}

variable "hosting_site_id" {
  description = <<-EOT
    Firebase Hosting site ID (typically the project ID for the default site).
    Used to derive `apiUrl` and `appUrl` in the secret JSON so the deploy
    workflow doesn't need to know them.
  EOT
  type        = string
}

variable "deploy_service_account_email" {
  description = "Email of the deploy SA that needs read access to the secret"
  type        = string
}
