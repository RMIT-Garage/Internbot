output "backend_id" {
  description = "Firebase App Hosting backend ID"
  value       = google_firebase_app_hosting_backend.frontend.backend_id
}

output "backend_uri" {
  description = "Primary URI for the App Hosting backend"
  value       = google_firebase_app_hosting_backend.frontend.uri
}

output "web_app_id" {
  description = "Firebase Web App ID associated with the App Hosting backend"
  value       = google_firebase_web_app.frontend.app_id
}

output "github_installation_state" {
  description = "GitHub App installation state for the Developer Connect connection"
  value       = google_developer_connect_connection.github.installation_state
}
