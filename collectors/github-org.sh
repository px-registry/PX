#!/bin/bash
set -euo pipefail

# PX collector: github-org
# Usage: ./collectors/github-org.sh <org> <repo>
# Output: evidence JSON on stdout
# Logs/errors: stderr

ORG="${1:?Usage: github-org.sh <org> <repo>}"
REPO="${2:?Usage: github-org.sh <org> <repo>}"

echo "Collecting GitHub org evidence for ${ORG}/${REPO}..." >&2

# Repo baseline
DEFAULT_BRANCH="$(gh api "/repos/${ORG}/${REPO}" --jq '.default_branch' 2>/dev/null || true)"
if [ -z "${DEFAULT_BRANCH}" ] || [ "${DEFAULT_BRANCH}" = "null" ]; then
  echo "Unable to read repository metadata for ${ORG}/${REPO}" >&2
  exit 1
fi

# Org settings
TWO_FA="$(gh api "/orgs/${ORG}" --jq '.two_factor_requirement_enabled // false' 2>/dev/null || echo "false")"
DEFAULT_PERM="$(gh api "/orgs/${ORG}" --jq '.default_repository_permission // "write"' 2>/dev/null || echo "write")"

# Branch protection
if gh api "/repos/${ORG}/${REPO}/branches/${DEFAULT_BRANCH}/protection" >/dev/null 2>&1; then
  BP_ENABLED="true"
else
  BP_ENABLED="false"
fi

PR_REVIEWS="$(gh api "/repos/${ORG}/${REPO}/branches/${DEFAULT_BRANCH}/protection/required_pull_request_reviews" --jq 'true' 2>/dev/null || echo "false")"
STATUS_CHECKS="$(gh api "/repos/${ORG}/${REPO}/branches/${DEFAULT_BRANCH}/protection/required_status_checks" --jq 'true' 2>/dev/null || echo "false")"
ENFORCE_ADMINS="$(gh api "/repos/${ORG}/${REPO}/branches/${DEFAULT_BRANCH}/protection/enforce_admins" --jq '.enabled // false' 2>/dev/null || echo "false")"

# Repo settings
DELETE_BRANCH_ON_MERGE="$(gh api "/repos/${ORG}/${REPO}" --jq '.delete_branch_on_merge // false' 2>/dev/null || echo "false")"

# Security and analysis
SECRET_SCANNING="$(gh api "/repos/${ORG}/${REPO}" --jq '(.security_and_analysis.secret_scanning.status == "enabled") // false' 2>/dev/null || echo "false")"
PUSH_PROTECTION="$(gh api "/repos/${ORG}/${REPO}" --jq '(.security_and_analysis.secret_scanning_push_protection.status == "enabled") // false' 2>/dev/null || echo "false")"
DEPENDABOT_ALERTS="$(gh api "/repos/${ORG}/${REPO}" --jq '(.security_and_analysis.dependabot_security_updates.status == "enabled") // false' 2>/dev/null || echo "false")"

cat <<EOF
{
  "_meta": {
    "source": "px-collector/github-org",
    "exported_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "collector_version": "1.0.0",
    "org": "${ORG}",
    "repo": "${ORG}/${REPO}"
  },
  "org": {
    "two_factor_requirement_enabled": ${TWO_FA},
    "default_repository_permission": "${DEFAULT_PERM}"
  },
  "repo": {
    "default_branch_protection": {
      "enabled": ${BP_ENABLED},
      "required_pull_request_reviews": ${PR_REVIEWS},
      "required_status_checks": ${STATUS_CHECKS},
      "enforce_admins": ${ENFORCE_ADMINS}
    },
    "delete_branch_on_merge": ${DELETE_BRANCH_ON_MERGE}
  },
  "security": {
    "secret_scanning": ${SECRET_SCANNING},
    "secret_scanning_push_protection": ${PUSH_PROTECTION},
    "dependabot_alerts": ${DEPENDABOT_ALERTS}
  }
}
EOF
