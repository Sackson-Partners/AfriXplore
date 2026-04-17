#!/bin/bash
# Publish trained Custom Vision iteration to prediction endpoint

set -euo pipefail

ENVIRONMENT=${1:-staging}
KV="kv-afrixplore-${ENVIRONMENT}"
RG="rg-afrixplore-${ENVIRONMENT}-southafricanorth"
PUBLISHED_NAME="mineral-id-v$(date +%Y%m)"

CV_TRAINING_KEY=$(az keyvault secret show \
  --vault-name "$KV" --name "custom-vision-training-key" --query value -o tsv)

CV_TRAINING_ENDPOINT=$(az cognitiveservices account show \
  --name "cv-afrixplore-training-${ENVIRONMENT}" \
  --resource-group "$RG" --query "properties.endpoint" -o tsv)

PROJECT_ID=$(az keyvault secret show \
  --vault-name "$KV" --name "custom-vision-project-id" --query value -o tsv)

ITERATION_ID=$(az keyvault secret show \
  --vault-name "$KV" --name "custom-vision-iteration-id" --query value -o tsv)

CV_PREDICTION_RESOURCE_ID=$(az keyvault secret show \
  --vault-name "$KV" --name "custom-vision-prediction-resource-id" --query value -o tsv)

echo "Publishing model: $PUBLISHED_NAME"
echo "Iteration:        $ITERATION_ID"
echo ""

curl -sf \
  -X POST \
  "${CV_TRAINING_ENDPOINT}customvision/v3.3/Training/projects/${PROJECT_ID}/iterations/${ITERATION_ID}/publish" \
  -H "Training-Key: ${CV_TRAINING_KEY}" \
  -G \
  --data-urlencode "publishName=${PUBLISHED_NAME}" \
  --data-urlencode "predictionId=${CV_PREDICTION_RESOURCE_ID}" \
  2>/dev/null > /dev/null

echo "✅ Model published as: $PUBLISHED_NAME"
echo ""

for APP in \
  "ca-afrixplore-geo-worker-${ENVIRONMENT}" \
  "ca-afrixplore-scout-api-${ENVIRONMENT}" \
  "ca-afrixplore-ai-inference-${ENVIRONMENT}"; do

  az containerapp update \
    --name "$APP" --resource-group "$RG" \
    --set-env-vars "CUSTOM_VISION_PUBLISHED_NAME=${PUBLISHED_NAME}" \
    --output none 2>/dev/null && \
    echo "  ✅ Updated: $APP" || \
    echo "  ⚠️  Could not update: $APP"
done

az keyvault secret set \
  --vault-name "$KV" --name "custom-vision-published-name" \
  --value "$PUBLISHED_NAME" --output none

echo ""
echo "✅ Model live: $PUBLISHED_NAME"
echo "   Test with: ./infrastructure/scripts/test-mineral-id.sh $ENVIRONMENT"
