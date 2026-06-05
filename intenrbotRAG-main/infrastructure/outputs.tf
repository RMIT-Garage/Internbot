output "project_id" {
  description = "Firebase project ID"
  value       = google_firebase_project.default.project
}

output "firestore_name" {
  description = "Firestore database name"
  value       = google_firestore_database.default.name
}

output "app_hosting_backend_id" {
  description = "Firebase App Hosting backend ID"
  value       = google_firebase_app_hosting_backend.frontend.backend_id
}
