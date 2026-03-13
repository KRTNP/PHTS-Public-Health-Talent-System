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

if [[ -z "${OWNER}" || -z "${REPO}" ]]; then
  echo "Usage: GH_TOKEN=<token> $0 <owner> <repo>"
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

api_put() {
  local url="$1"
  local body="$2"
  curl -fsS -X PUT \
    -H "${AUTH_HEADER}" \
    -H "${ACCEPT_HEADER}" \
    -H "${VERSION_HEADER}" \
    "${url}" \
    -d "${body}" >/dev/null
}

api_patch() {
  local url="$1"
  local body="$2"
  curl -fsS -X PATCH \
    -H "${AUTH_HEADER}" \
    -H "${ACCEPT_HEADER}" \
    -H "${VERSION_HEADER}" \
    "${url}" \
    -d "${body}" >/dev/null
}

api_put_with_code() {
  local url="$1"
  local body="$2"
  local response_file
  response_file="$(mktemp)"
  local http_code
  http_code="$(
    curl -sS -o "${response_file}" -w "%{http_code}" -X PUT \
      -H "${AUTH_HEADER}" \
      -H "${ACCEPT_HEADER}" \
      -H "${VERSION_HEADER}" \
      "${url}" \
      -d "${body}"
  )"
  cat "${response_file}" >&2 || true
  rm -f "${response_file}"
  echo "${http_code}"
}

protect_branch() {
  local branch="$1"
  local contexts_json="$2"
  local strict_mode="$3"

  api_put \
    "${API}/repos/${OWNER}/${REPO}/branches/${branch}/protection" \
    "{
      \"required_status_checks\": {
        \"strict\": ${strict_mode},
        \"contexts\": ${contexts_json}
      },
      \"enforce_admins\": true,
      \"required_pull_request_reviews\": {
        \"dismiss_stale_reviews\": true,
        \"require_code_owner_reviews\": true,
        \"required_approving_review_count\": 1
      },
      \"restrictions\": null,
      \"required_linear_history\": true,
      \"allow_force_pushes\": false,
      \"allow_deletions\": false,
      \"block_creations\": false,
      \"required_conversation_resolution\": true,
      \"lock_branch\": false,
      \"allow_fork_syncing\": true
    }"
}

echo "[1/4] Apply repository merge policy"
api_patch \
  "${API}/repos/${OWNER}/${REPO}" \
  '{
    "allow_squash_merge": true,
    "allow_merge_commit": false,
    "allow_rebase_merge": false,
    "allow_auto_merge": true,
    "delete_branch_on_merge": true
  }'
echo "  - merge policy configured"

echo "[2/4] Apply branch protection for main"
protect_branch \
  "main" \
  '["CI / backend-test","CI / frontend-build","CodeQL / Analyze","Snyk / dependency-scan"]' \
  "true"
echo "  - main protected"

echo "[3/4] Apply branch protection for dev"
protect_branch \
  "dev" \
  '["CI / backend-test","CI / frontend-build","CodeQL / Analyze","Snyk / dependency-scan"]' \
  "true"
echo "  - dev protected"

echo "[4/4] Ensure environments exist"
for env_name in staging production; do
  env_url="${API}/repos/${OWNER}/${REPO}/environments/${env_name}"
  http_code="$(
    api_put_with_code \
      "${env_url}" \
      '{"wait_timer":0,"prevent_self_review":false,"reviewers":[],"deployment_branch_policy":{"protected_branches":true,"custom_branch_policies":false}}'
  )"

  if [[ "${http_code}" == "422" ]]; then
    echo "  - ${env_name}: got 422, retrying with minimal payload"
    api_put \
      "${env_url}" \
      '{"wait_timer":0,"reviewers":[]}'
    echo "  - ensured environment: ${env_name} (fallback mode)"
  elif [[ "${http_code}" == "200" ]]; then
    echo "  - ensured environment: ${env_name}"
  else
    echo "ERROR: failed to ensure environment '${env_name}' (HTTP ${http_code})"
    exit 1
  fi
done

echo "Done. Repository settings applied for ${OWNER}/${REPO}."
echo "Next: add repository/environment secrets in GitHub UI."
