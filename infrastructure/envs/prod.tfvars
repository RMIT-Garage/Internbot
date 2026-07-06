project_id          = "internbot-65e94"
state_bucket        = "internbot-65e94-tf-state"
billing_account     = "01BA89-528863-1284CC"
github_allowed_refs = ["refs/heads/main"]

# Co-located with Functions. Firestore location is permanent once the DB exists.
firestore_location = "australia-southeast1"

# MUST be false on the FIRST apply of a fresh project — enforceStudentEmail
# isn't deployed yet, so the auth module's URL data source would fail.
wire_blocking_function = false
