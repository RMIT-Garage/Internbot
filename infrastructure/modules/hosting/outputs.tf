output "site_id" {
  description = "Firebase Hosting site ID (same as project ID for the default site)"
  value       = google_firebase_hosting_site.default.site_id
}

output "default_url" {
  description = "Primary hosting URL — https://{site}.web.app"
  value       = "https://${google_firebase_hosting_site.default.site_id}.web.app"
}

output "firebase_url" {
  description = "Legacy hosting URL — https://{site}.firebaseapp.com"
  value       = "https://${google_firebase_hosting_site.default.site_id}.firebaseapp.com"
}
