output "app_id" {
  description = "Firebase Web App ID"
  value       = google_firebase_web_app.default.app_id
}

output "secret_name" {
  description = "Short secret ID for the Firebase web SDK config — fetch via `gcloud secrets versions access latest --secret={value} --project={project_id}`"
  value       = google_secret_manager_secret.firebase_web_config.secret_id
}

output "secret_resource_name" {
  description = "Fully qualified Secret Manager resource name (projects/.../secrets/firebase-web-config)"
  value       = google_secret_manager_secret.firebase_web_config.id
}
