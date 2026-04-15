output "wif_provider" {
  description = "Full resource name of the Workload Identity Provider"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "deploy_service_account" {
  description = "Email of the github-deploy (write) service account"
  value       = google_service_account.deploy.email
}

output "planner_service_account" {
  description = "Email of the github-planner (read-only) service account used by terraform plan on PR workflows"
  value       = google_service_account.planner.email
}

output "wif_pool_id" {
  description = "Workload Identity Pool ID (short form)"
  value       = google_iam_workload_identity_pool.github.workload_identity_pool_id
}
