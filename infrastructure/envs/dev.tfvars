project_id          = "internbot-dev-f1abe"
state_bucket        = "internbot-dev-f1abe-tf-state"
billing_account     = "01230B-407303-E4AD1F"
github_allowed_refs = ["refs/heads/develop"]

# Firestore location. Pinned to australia-southeast1 (co-located with Functions)
# to match the (default) database already created on this project. Firestore
# location is permanent, so this must match the existing DB.
firestore_location = "australia-southeast1"

# Wire the GCIP `beforeCreate` blocking function (`enforceStudentEmail`).
# MUST stay false on the FIRST apply of a fresh project — the function isn't
# deployed yet, so the auth module's URL data source would fail. After the
# first apply + `firebase deploy --only functions:enforceStudentEmail`, set
# this to true and re-apply (HANDOVER §6 two-step).
wire_blocking_function = false
