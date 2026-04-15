#!/usr/bin/env bash
# Import existing manually-created GCP resources into Terraform state.
# Run this ONCE per environment, after the first `terraform init`, before any plan/apply.
#
# Usage:
#   ./scripts/import-existing.sh dev
#   ./scripts/import-existing.sh prod
#
# Prereqs:
#   - gcloud authenticated as a user/SA with read access to the target project
#   - terraform initialised with the correct backend (terraform init -backend-config=...)
#   - TF_VAR_* env vars set (project_id, github_repository, github_repository_id, github_allowed_refs)

set -euo pipefail

env="${1:-}"
if [[ "$env" != "dev" && "$env" != "prod" ]]; then
  echo "Usage: $0 {dev|prod}" >&2
  exit 1
fi

if [[ "$env" == "dev" ]]; then
  project="internbot-dev-ae3a3"
else
  project="internbot-prod"
fi

echo "Importing existing github-oidc resources for $project..."

terraform import "module.github_oidc.google_iam_workload_identity_pool.github" \
  "projects/$project/locations/global/workloadIdentityPools/github"

terraform import "module.github_oidc.google_iam_workload_identity_pool_provider.github" \
  "projects/$project/locations/global/workloadIdentityPools/github/providers/github-provider"

terraform import "module.github_oidc.google_service_account.deploy" \
  "projects/$project/serviceAccounts/github-deploy@$project.iam.gserviceaccount.com"

roles=(
  "roles/firebase.admin"
  "roles/cloudfunctions.admin"
  "roles/artifactregistry.writer"
  "roles/iam.serviceAccountUser"
  "roles/run.admin"
  "roles/serviceusage.serviceUsageConsumer"
)

for role in "${roles[@]}"; do
  terraform import \
    "module.github_oidc.google_project_iam_member.deploy_roles[\"$role\"]" \
    "$project $role serviceAccount:github-deploy@$project.iam.gserviceaccount.com"
done

terraform import "module.github_oidc.google_service_account_iam_member.deploy_wif_binding" \
  "projects/$project/serviceAccounts/github-deploy@$project.iam.gserviceaccount.com roles/iam.workloadIdentityUser principalSet://iam.googleapis.com/projects/$(gcloud projects describe $project --format='value(projectNumber)')/locations/global/workloadIdentityPools/github/attribute.repository/giatinhuynh/Internbot"

echo ""
echo "Import complete. Run 'terraform plan' — it should show 0 changes if everything matches."
