# AWS Evidence Export Guide

How to collect the evidence PX needs to verify your AWS state against `profiles/aws-core-controls-v1.json`.

## Overview

PX does not connect to AWS. You export your AWS state as JSON, then PX verifies it locally.

The target format is a flat JSON file matching the structure in `examples/aws-state-passing.json`.

## Collecting each section

### IAM

```bash
# Account-level summary (MFA, access keys)
aws iam get-account-summary --output json

# Credential report (per-user MFA status)
aws iam generate-credential-report
aws iam get-credential-report --output json

# Password policy
aws iam get-account-password-policy --output json

# Root access key status
aws iam get-account-summary --query 'SummaryMap.AccountAccessKeysPresent'
```

Map to evidence:

| Evidence field | Source |
|---|---|
| `iam.mfa_enabled` | `SummaryMap.MFADevices > 0` for all users, or check credential report `mfa_active` column |
| `iam.root_access_key_active` | `SummaryMap.AccountAccessKeysPresent > 0` |
| `iam.password_policy.minimum_length` | `PasswordPolicy.MinimumPasswordLength` |

### RDS

```bash
aws rds describe-db-instances --output json
```

Map to evidence:

| Evidence field | Source |
|---|---|
| `rds.storage_encrypted` | `DBInstances[].StorageEncrypted` |
| `rds.publicly_accessible` | `DBInstances[].PubliclyAccessible` |

If you have multiple instances, report the worst case (any unencrypted = `false`, any public = `true`).

### S3

```bash
# Public access block (account level)
aws s3control get-public-access-block --account-id YOUR_ACCOUNT_ID --output json

# Or per-bucket
aws s3api get-public-access-block --bucket YOUR_BUCKET --output json

# Versioning
aws s3api get-bucket-versioning --bucket YOUR_BUCKET --output json
```

Map to evidence:

| Evidence field | Source |
|---|---|
| `s3.public_access_blocked` | All four `PublicAccessBlockConfiguration` flags are `true` |
| `s3.versioning` | `Status` is `"Enabled"` |

### CloudTrail

```bash
aws cloudtrail describe-trails --output json
aws cloudtrail get-trail-status --name YOUR_TRAIL --output json
```

Map to evidence:

| Evidence field | Source |
|---|---|
| `cloudtrail.is_logging` | `GetTrailStatusResponse.IsLogging` |
| `cloudtrail.is_multi_region` | `trailList[].IsMultiRegionTrail` |

### VPC

```bash
aws ec2 describe-flow-logs --output json
```

Map to evidence:

| Evidence field | Source |
|---|---|
| `vpc.flow_logs_enabled` | `FlowLogs` array is non-empty for your VPC |

## Assembling the evidence file

Combine the results into a single JSON file:

```json
{
  "_meta": {
    "source": "AWS CLI export",
    "exported_at": "2026-03-17T10:00:00Z",
    "account_id": "123456789012",
    "region": "ap-northeast-1"
  },
  "iam": {
    "mfa_enabled": true,
    "root_access_key_active": false,
    "password_policy": {
      "minimum_length": 14
    }
  },
  "rds": {
    "storage_encrypted": true,
    "publicly_accessible": false
  },
  "s3": {
    "public_access_blocked": true,
    "versioning": true
  },
  "cloudtrail": {
    "is_logging": true,
    "is_multi_region": true
  },
  "vpc": {
    "flow_logs_enabled": true
  }
}
```

Save this as e.g. `my-aws-state.json`, then run:

```bash
node cli.js verify --profile=profiles/aws-core-controls-v1.json --evidence=my-aws-state.json
```

## Notes

- The `_meta` section is for your records. PX does not read it during verification.
- Report the worst case when you have multiple resources (e.g. multiple RDS instances, multiple S3 buckets).
- Keep exported data local. Do not commit files containing account IDs or credential reports to public repositories.
