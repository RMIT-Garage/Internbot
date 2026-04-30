project_id          = "internbot-dev-ae3a3"
state_bucket        = "internbot-dev-ae3a3-tf-state"
billing_account     = "0161F5-9777AE-74E102"
github_allowed_refs = ["refs/heads/develop"]

# Wire the GCIP `beforeCreate` blocking function (`enforceStudentEmail`).
# Bootstrap step 3 — the function was deployed in the previous release, so
# Terraform can now look up its URL via the data source and grant the GCIP
# service agent `roles/run.invoker` on the Cloud Run service.
wire_blocking_function = true
