#!/bin/bash
set -euo pipefail

# PX collector: aws-account
# Output: evidence JSON on stdout
# Logs/errors: stderr

echo "Collecting AWS account evidence..." >&2

to_bool() {
  case "$1" in
    1|true|True|TRUE) echo "true" ;;
    *) echo "false" ;;
  esac
}

ACCOUNT_ID="$(aws sts get-caller-identity --query 'Account' --output text 2>/dev/null || true)"

# IAM
MFA_ENABLED="$(aws iam get-account-summary --query 'SummaryMap.AccountMFAEnabled' --output text 2>/dev/null || echo "0")"
ROOT_KEY_PRESENT="$(aws iam get-account-summary --query 'SummaryMap.AccountAccessKeysPresent' --output text 2>/dev/null || echo "1")"
PW_MIN_LEN="$(aws iam get-account-password-policy --query 'PasswordPolicy.MinimumPasswordLength' --output text 2>/dev/null || echo "0")"

# RDS (first instance only; conservative fallback)
RDS_ENCRYPTED="$(aws rds describe-db-instances --query 'DBInstances[0].StorageEncrypted' --output text 2>/dev/null || echo "false")"
RDS_PUBLIC="$(aws rds describe-db-instances --query 'DBInstances[0].PubliclyAccessible' --output text 2>/dev/null || echo "true")"

# S3 account-level public access block
if [ -n "${ACCOUNT_ID}" ] && [ "${ACCOUNT_ID}" != "None" ]; then
  S3_BLOCKED="$(aws s3control get-public-access-block --account-id "${ACCOUNT_ID}" --query 'PublicAccessBlockConfiguration.BlockPublicAcls' --output text 2>/dev/null || echo "false")"
else
  S3_BLOCKED="false"
fi

# S3 versioning: first bucket only; conservative fallback
FIRST_BUCKET="$(aws s3api list-buckets --query 'Buckets[0].Name' --output text 2>/dev/null || true)"
if [ -n "${FIRST_BUCKET}" ] && [ "${FIRST_BUCKET}" != "None" ]; then
  VERSIONING_STATUS="$(aws s3api get-bucket-versioning --bucket "${FIRST_BUCKET}" --query 'Status' --output text 2>/dev/null || echo "None")"
  if [ "${VERSIONING_STATUS}" = "Enabled" ]; then
    S3_VERSIONING="true"
  else
    S3_VERSIONING="false"
  fi
else
  S3_VERSIONING="false"
fi

# CloudTrail: first trail only; conservative fallback
FIRST_TRAIL="$(aws cloudtrail describe-trails --query 'trailList[0].Name' --output text 2>/dev/null || true)"
if [ -n "${FIRST_TRAIL}" ] && [ "${FIRST_TRAIL}" != "None" ]; then
  CT_LOGGING="$(aws cloudtrail get-trail-status --name "${FIRST_TRAIL}" --query 'IsLogging' --output text 2>/dev/null || echo "false")"
  CT_MULTI="$(aws cloudtrail describe-trails --query 'trailList[0].IsMultiRegionTrail' --output text 2>/dev/null || echo "false")"
else
  CT_LOGGING="false"
  CT_MULTI="false"
fi

# VPC flow logs: any existing flow log counts as true
FLOW_LOG_ID="$(aws ec2 describe-flow-logs --query 'FlowLogs[0].FlowLogId' --output text 2>/dev/null || true)"
if [ -n "${FLOW_LOG_ID}" ] && [ "${FLOW_LOG_ID}" != "None" ]; then
  VPC_FLOW="true"
else
  VPC_FLOW="false"
fi

cat <<EOF
{
  "_meta": {
    "source": "px-collector/aws-account",
    "exported_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "collector_version": "1.0.0"
  },
  "iam": {
    "mfa_enabled": $(to_bool "${MFA_ENABLED}"),
    "root_access_key_active": $([ "${ROOT_KEY_PRESENT}" = "0" ] && echo "false" || echo "true"),
    "password_policy": {
      "minimum_length": ${PW_MIN_LEN:-0}
    }
  },
  "rds": {
    "storage_encrypted": $(to_bool "${RDS_ENCRYPTED}"),
    "publicly_accessible": $(to_bool "${RDS_PUBLIC}")
  },
  "s3": {
    "public_access_blocked": $(to_bool "${S3_BLOCKED}"),
    "versioning": ${S3_VERSIONING}
  },
  "cloudtrail": {
    "is_logging": $(to_bool "${CT_LOGGING}"),
    "is_multi_region": $(to_bool "${CT_MULTI}")
  },
  "vpc": {
    "flow_logs_enabled": ${VPC_FLOW}
  }
}
EOF
