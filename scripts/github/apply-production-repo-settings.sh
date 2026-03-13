#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   GH_TOKEN=<token> ./scripts/github/apply-production-repo-settings.sh KRTNP phts-uttaradit-hospital
#
# Required token scopes:
# - Fine-grained token: Administration (read/write), Contents (read), Actions (read)
# - Classic token: repo + admin:repo_hook

OWNER="${1:-}"
REPO="${2:-}"
BRANCH="${3:-main}"

if [[ -z "${OWNER}" || -z "${REPO}" ]]; then
  echo "Usage: GH_TOKEN=<token> $0 <owner> <repo> [branch]"
  exit 1
fi

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "ERROR: GH_TOKEN is required"
  exit 1
fi

API="https://api.github.com"
AUTH_HEADER="Authorization: Bearer ${GH_TOKEN}"
ACCEPT_HEADER="Accept: application/vnd.github+json"
VERSION_HEADER="X-GitHub-Api-Version: 2022-11-28"

echo "[1/3] Apply branch protection for ${OWNER}/${REPO}:${BRANCH}"
curl -sS -X PUT \
  -H "${AUTH_HEADER}" \
  -H "${ACCEPT_HEADER}" \
  -H "${VERSION_HEADER}" \
  "${API}/repos/${OWNER}/${REPO}/branches/${BRANCH}/protection" \
  -d @- <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "CI / backend-test",
      "CI / frontend-build",
      "CodeQL / Analyze",
      "Snyk / dependency-scan"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": true
}
JSON
echo

echo "[2/3] Ensure environments exist"
for env_name in staging production; do
  curl -sS -X PUT \
    -H "${AUTH_HEADER}" \
    -H "${ACCEPT_HEADER}" \
    -H "${VERSION_HEADER}" \
    "${API}/repos/${OWNER}/${REPO}/environments/${env_name}" \
    -d '{"wait_timer":0,"prevent_self_review":false,"reviewers":[],"deployment_branch_policy":{"protected_branches":true,"custom_branch_policies":false}}' \
    >/dev/null
  echo "  - ensured environment: ${env_name}"
done

echo "[3/3] Summary"
echo "Repository settings applied for ${OWNER}/${REPO}."
echo "Next: add repository/environment secrets in GitHub UI."
