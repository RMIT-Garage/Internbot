output "bucket_id" {
  description = "Firebase Storage bucket ID"
  value       = google_firebase_storage_bucket.default.bucket_id
}
