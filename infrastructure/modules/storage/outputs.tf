output "bucket_id" {
  description = "Firebase Storage bucket ID"
  value       = google_firebase_storage_bucket.default.bucket_id
}

output "bucket_name" {
  description = "GCS bucket name — the value the Firebase SDK uses as `storageBucket`"
  value       = google_storage_bucket.default.name
}
