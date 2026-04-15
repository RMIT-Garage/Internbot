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
#
# Note: the legacy deploy_wif_binding (at attribute.repository) is NOT imported
# because the module has been refactored to use ref-scoped bindings. If that
# binding still exists on the SA, remove it manually before running:
#   gcloud iam service-accounts remove-iam-policy-binding \
#     github-deploy@PROJECT.iam.gserviceaccount.com \
#     --project=PROJECT \
#     --role="roles/iam.workloadIdentityUser" \
#     --member="principalSet://.../attribute.repository/OWNER/REPO"

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

terraform import -var-file="envs/$env.tfvars" "module.github_oidc.google_iam_workload_identity_pool.github" \
  "projects/$project/locations/global/workloadIdentityPools/github"

terraform import -var-file="envs/$env.tfvars" "module.github_oidc.google_iam_workload_identity_pool_provider.github" \
  "projects/$project/locations/global/workloadIdentityPools/github/providers/github-provider"

terraform import -var-file="envs/$env.tfvars" "module.github_oidc.google_service_account.deploy" \
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
  terraform import -var-file="envs/$env.tfvars" \
    "module.github_oidc.google_project_iam_member.deploy_roles[\"$role\"]" \
    "$project $role serviceAccount:github-deploy@$project.iam.gserviceaccount.com"
done

echo ""
echo "Import complete. Run 'terraform plan' — it should show additions for the"
echo "new planner SA + ref-scoped deploy WIF binding + firestore/storage rules."
