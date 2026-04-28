# Default Firebase Hosting site.
#
# When a project is enabled for Firebase, a default hosting site is auto-
# created with `site_id == project_id`. We bring that site under Terraform
# management so it's tracked in state. `lifecycle.ignore_changes = all`
# tolerates attributes that the Firebase backend sets after creation
# (app association, etc.) without churning plans.
#
# First-time adoption on an existing project: `terraform import`. See
# infrastructure/scripts/import-existing.sh.
resource "google_firebase_hosting_site" "default" {
  provider = google-beta
  project  = var.project_id
  site_id  = var.project_id

  lifecycle {
    prevent_destroy = true
    ignore_changes  = all
  }
}
