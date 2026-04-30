output "project_id" {
  description = "Firebase project ID"
  value       = module.firebase_project.project_id
}

output "firestore_name" {
  description = "Firestore database name"
  value       = module.firestore.database_name
}

output "wif_provider" {
  description = "Full resource name of the Workload Identity Provider — pass to google-github-actions/auth@v2"
  value       = module.github_oidc.wif_provider
}

output "deploy_service_account" {
  description = "Email of the github-deploy (write) service account — use in deploy workflows"
  value       = module.github_oidc.deploy_service_account
}

output "planner_service_account" {
  description = "Email of the github-planner (read-only) service account — use in terraform-plan.yml"
  value       = module.github_oidc.planner_service_account
}

output "hosting_site_id" {
  description = "Firebase Hosting site ID for the default site"
  value       = module.hosting.site_id
}

output "hosting_url" {
  description = "Primary Firebase Hosting URL (.web.app) — where the static frontend is served"
  value       = module.hosting.default_url
}

output "firebase_web_app_id" {
  description = "Firebase Web App ID — also baked into the firebase-web-config secret"
  value       = module.web_app.app_id
}

output "firebase_web_config_secret" {
  description = "Short name of the Secret Manager secret holding the Firebase web SDK config JSON. The hosting deploy workflow reads it via gcloud."
  value       = module.web_app.secret_name
}
