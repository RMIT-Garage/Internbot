variable "project_id" {
  description = "The GCP/Firebase project ID"
  type        = string
}

variable "location" {
  description = "GCS bucket location (region or multi-region). Should match the region used for Functions/Firestore for lowest egress."
  type        = string
  default     = "australia-southeast1"
}
