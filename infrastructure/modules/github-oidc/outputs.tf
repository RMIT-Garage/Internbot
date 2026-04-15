output "wif_provider" {
  description = "Full resource name of the Workload Identity Provider"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "deploy_service_account" {
  description = "Email of the github-deploy service account"
  value       = google_service_account.deploy.email
}

output "wif_pool_id" {
  description = "Workload Identity Pool ID (short form)"
  value       = google_iam_workload_identity_pool.github.workload_identity_pool_id
}
