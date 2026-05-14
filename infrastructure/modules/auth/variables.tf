variable "project_id" {
  description = "The GCP/Firebase project ID"
  type        = string
}

variable "region" {
  description = "Region where the blocking function is deployed."
  type        = string
  default     = "australia-southeast1"
}

variable "extra_authorized_domains" {
  description = <<-EOT
    Additional domains authorized for Firebase Auth sign-in (OAuth redirects
    and email/password from a browser).

    Always-included defaults: `localhost`, `<project_id>.firebaseapp.com`,
    `<project_id>.web.app`. Add custom domains here (e.g. a staging hostname
    or production custom domain) — Firebase rejects sign-in attempts from
    domains not on this list with `auth/unauthorized-domain`.
  EOT
  type        = list(string)
  default     = []
}

variable "wire_blocking_function" {
  description = <<-EOT
    Wire the GCIP `beforeCreate` blocking function (`enforceStudentEmail`)
    that enforces the RMIT-student-email policy at the IdP layer.

    Bootstrap order for a *new* environment:
      1. First apply with `wire_blocking_function = false` (default).
         Upgrades the project to Identity Platform; the trigger is unwired.
      2. Deploy the function:
            firebase deploy --only functions:enforceStudentEmail
         The deterministic Cloud Run URL is now discoverable via the
         `google_cloudfunctions2_function` data source.
      3. Flip to `wire_blocking_function = true` and re-apply.
         Terraform reads the URL, wires the trigger, and grants
         `roles/run.invoker` to the GCIP service agent.

    Steady state: leave `true`. Subsequent code updates ship via
    `firebase deploy`; the URL is stable so Terraform sees no diff.
  EOT
  type        = bool
  default     = false
}
