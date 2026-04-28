# GCIP `beforeCreate` blocking function discovery.
#
# When wired, the function URL is read from the deployed Cloud Function
# rather than hand-passed via tfvars — the deterministic
# `cloudfunctions.net` URL is stable across deploys, so Terraform never
# sees drift after the function exists.
#
# Bootstrap dance for a fresh environment is documented on the
# `wire_blocking_function` variable.
data "google_cloudfunctions2_function" "before_create" {
  count = var.wire_blocking_function ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = "enforceStudentEmail"
}

# GCIP service agent that invokes blocking functions. Auto-created by
# Google when the project is upgraded to Identity Platform (which happens
# via `google_identity_platform_config` below). Without `roles/run.invoker`
# on the underlying Cloud Run v2 service the trigger fires but receives a
# 403 and the sign-up succeeds without the policy check — silently
# degrading to "no enforcement".
resource "google_cloud_run_v2_service_iam_member" "gcip_invoker" {
  count = var.wire_blocking_function ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = "enforcestudentemail" # Cloud Run v2 service name == lowercase function name
  role     = "roles/run.invoker"
  member   = "serviceAccount:service-${var.project_number}@gcp-sa-identitytoolkit.iam.gserviceaccount.com"

  depends_on = [data.google_cloudfunctions2_function.before_create]
}

resource "google_identity_platform_config" "default" {
  provider = google-beta
  project  = var.project_id

  sign_in {
    allow_duplicate_emails = false

    email {
      enabled           = true
      password_required = true
    }

    anonymous {
      enabled = false
    }
  }

  # Wired only when both the function exists and the toggle is on. The
  # dynamic block + the data source's `count` keep first-apply (function
  # not yet deployed) from failing on a missing data-source lookup.
  dynamic "blocking_functions" {
    for_each = var.wire_blocking_function ? [1] : []

    content {
      triggers {
        event_type   = "beforeCreate"
        function_uri = data.google_cloudfunctions2_function.before_create[0].service_config[0].uri
      }

      forward_inbound_credentials {
        id_token      = false
        access_token  = false
        refresh_token = false
      }
    }
  }

  depends_on = [google_cloud_run_v2_service_iam_member.gcip_invoker]
}
