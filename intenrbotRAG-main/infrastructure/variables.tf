variable "project_id" {
  description = "The GCP/Firebase project ID"
  type        = string
}

variable "region" {
  description = "The GCP region for Cloud Functions and App Hosting"
  type        = string
  default     = "australia-southeast1"
}

variable "firestore_location" {
  description = "The Firestore database location"
  type        = string
  default     = "australia-southeast2"
}
