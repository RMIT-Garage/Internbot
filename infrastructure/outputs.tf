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

output "apphosting_backend_id" {
  description = "Firebase App Hosting backend ID for the Next.js frontend"
  value       = module.app_hosting.backend_id
}

output "apphosting_backend_uri" {
  description = "Primary URI for the App Hosting backend"
  value       = module.app_hosting.backend_uri
}

output "apphosting_web_app_id" {
  description = "Firebase Web App ID associated with the App Hosting backend"
  value       = module.app_hosting.web_app_id
}

output "apphosting_github_installation_state" {
  description = "GitHub App installation state for the Developer Connect connection"
  value       = module.app_hosting.github_installation_state
}
