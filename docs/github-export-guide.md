# GitHub Evidence Export Guide

How to collect the evidence PX needs to verify your GitHub organization and repository settings against `profiles/github-org-security-v1.json`.

## Overview

PX does not connect to GitHub. You export your org/repo state as JSON using the `gh` CLI, then PX verifies it locally.

The target format is a flat JSON file matching the structure in `examples/github-state-passing.json`.

## Requirements

- [GitHub CLI](https://cli.github.com/) (`gh`) installed and authenticated
- Org admin or repo admin access for the resources you are checking

## Collecting each section

### Organization settings

```bash
# Org-level settings (2FA requirement, default permissions)
gh api orgs/YOUR_ORG --jq '{
  two_factor_requirement_enabled,
  default_repository_permission
}'
```

Map to evidence:

| Evidence field | Source |
|---|---|
| `org.two_factor_requirement_enabled` | `.two_factor_requirement_enabled` |
| `org.default_repository_permission` | `.default_repository_permission` (`read`, `write`, `admin`, or `none`) |

### Repository branch protection

```bash
# Branch protection on the default branch
gh api repos/YOUR_ORG/YOUR_REPO/branches/main/protection --jq '{
  enabled: true,
  required_pull_request_reviews: (.required_pull_request_reviews != null),
  required_status_checks: (.required_status_checks != null),
  enforce_admins: .enforce_admins.enabled
}'
```

Note: if the API returns 404, branch protection is not enabled. Set `enabled` to `false` and all sub-fields to `false`.

```bash
# Delete branch on merge
gh api repos/YOUR_ORG/YOUR_REPO --jq '.delete_branch_on_merge'
```

Map to evidence:

| Evidence field | Source |
|---|---|
| `repo.default_branch_protection.enabled` | Protection rule exists (non-404) |
| `repo.default_branch_protection.required_pull_request_reviews` | `.required_pull_request_reviews` is not null |
| `repo.default_branch_protection.required_status_checks` | `.required_status_checks` is not null |
| `repo.default_branch_protection.enforce_admins` | `.enforce_admins.enabled` |
| `repo.delete_branch_on_merge` | `.delete_branch_on_merge` |

### Security features

```bash
# Secret scanning and Dependabot
gh api repos/YOUR_ORG/YOUR_REPO --jq '{
  secret_scanning: (.security_and_analysis.secret_scanning.status == "enabled"),
  secret_scanning_push_protection: (.security_and_analysis.secret_scanning_push_protection.status == "enabled"),
  dependabot_alerts: (.security_and_analysis.dependabot_security_updates.status == "enabled")
}'
```

Map to evidence:

| Evidence field | Source |
|---|---|
| `security.secret_scanning` | `.security_and_analysis.secret_scanning.status` is `"enabled"` |
| `security.secret_scanning_push_protection` | `.security_and_analysis.secret_scanning_push_protection.status` is `"enabled"` |
| `security.dependabot_alerts` | `.security_and_analysis.dependabot_security_updates.status` is `"enabled"` |

## Assembling the evidence file

Combine the results into a single JSON file:

```json
{
  "_meta": {
    "source": "gh api export",
    "exported_at": "2026-03-18T10:00:00Z",
    "org": "your-org",
    "repo": "your-org/your-repo"
  },
  "org": {
    "two_factor_requirement_enabled": true,
    "default_repository_permission": "read"
  },
  "repo": {
    "default_branch_protection": {
      "enabled": true,
      "required_pull_request_reviews": true,
      "required_status_checks": true,
      "enforce_admins": true
    },
    "delete_branch_on_merge": true
  },
  "security": {
    "secret_scanning": true,
    "secret_scanning_push_protection": true,
    "dependabot_alerts": true
  }
}
```

Save as e.g. `my-github-state.json`, then run:

```bash
node cli.js verify --profile=profiles/github-org-security-v1.json --evidence=my-github-state.json
```

## Notes

- The `_meta` section is for your records. PX does not read it during verification.
- If you manage multiple repos, check the one with the strictest requirements first. Each repo needs its own evidence file.
- Keep exported data local. Do not commit files containing org names or internal repo details to public repositories.
