#!/bin/bash
# Verify all required GitHub Actions secrets are set
# Usage: ./infrastructure/scripts/check-github-secrets.sh

set -euo pipefail

REPO="Sackson-Partners/AfriXplore"

REQUIRED_SECRETS=(
  "AZURE_CREDENTIALS_DEV"
  "AZURE_CREDENTIALS_STAGING"
  "AZURE_CREDENTIALS_PROD"
  "AZURE_SUBSCRIPTION_ID"
  "VERCEL_TOKEN"
  "VERCEL_ORG_ID"
  "VERCEL_PROJECT_ID_PLATFORM"
  "VERCEL_PROJECT_ID_ADMIN"
  "EXPO_TOKEN"
  "CUSTOM_VISION_PROJECT_ID"
  "CUSTOM_VISION_PREDICTION_ENDPOINT"
  "CUSTOM_VISION_TRAINING_ENDPOINT"
  "SLACK_WEBHOOK_URL"
  "CODECOV_TOKEN"
)

echo "Checking GitHub Secrets for ${REPO}..."
echo ""

MISSING=0
SECRET_LIST=$(gh secret list --repo "$REPO" --json name --jq '.[].name' 2>/dev/null || echo "")

for secret in "${REQUIRED_SECRETS[@]}"; do
  if echo "$SECRET_LIST" | grep -qx "$secret"; then
    echo "  OK  $secret"
  else
    echo "  MISSING: $secret"
    ((MISSING++))
  fi
done

echo ""
if [ "$MISSING" -eq 0 ]; then
  echo "All ${#REQUIRED_SECRETS[@]} secrets configured."
else
  echo "$MISSING of ${#REQUIRED_SECRETS[@]} secrets missing."
  echo ""
  echo "Add via: gh secret set SECRET_NAME --repo $REPO"
fi
