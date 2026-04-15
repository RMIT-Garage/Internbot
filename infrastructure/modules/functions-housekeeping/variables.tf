variable "project_id" {
  description = "GCP project ID where Cloud Functions v2 deploys"
  type        = string
}

variable "region" {
  description = "Region the functions deploy to (matches Cloud Function region)"
  type        = string
}
