#!/bin/bash
# Test mineral identification with a real image

set -euo pipefail

ENVIRONMENT=${1:-staging}
TEST_IMAGE=${2:-"infrastructure/assets/seed-images/copper/test.jpg"}
KV="kv-afrixplore-${ENVIRONMENT}"
RG="rg-afrixplore-${ENVIRONMENT}-southafricanorth"

CV_PREDICTION_KEY=$(az keyvault secret show \
  --vault-name "$KV" --name "custom-vision-prediction-key" --query value -o tsv)

CV_PREDICTION_ENDPOINT=$(az cognitiveservices account show \
  --name "cv-afrixplore-prediction-${ENVIRONMENT}" \
  --resource-group "$RG" --query "properties.endpoint" -o tsv)

PROJECT_ID=$(az keyvault secret show \
  --vault-name "$KV" --name "custom-vision-project-id" --query value -o tsv)

PUBLISHED_NAME=$(az keyvault secret show \
  --vault-name "$KV" --name "custom-vision-published-name" \
  --query value -o tsv 2>/dev/null || echo "mineral-id-v1")

if [ ! -f "$TEST_IMAGE" ]; then
  echo "Test image not found: $TEST_IMAGE"
  echo "Usage: $0 [environment] [image_path]"
  exit 1
fi

echo "Testing mineral ID..."
echo "Image:     $TEST_IMAGE"
echo "Model:     $PUBLISHED_NAME"
echo ""

START=$(date +%s%3N)

RESULT=$(curl -sf \
  -X POST \
  "${CV_PREDICTION_ENDPOINT}customvision/v3.0/Prediction/${PROJECT_ID}/classify/iterations/${PUBLISHED_NAME}/image" \
  -H "Prediction-Key: ${CV_PREDICTION_KEY}" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@${TEST_IMAGE}" 2>/dev/null || echo "")

END=$(date +%s%3N)
echo "Latency: $((END - START))ms"
echo ""
echo "Top 3 predictions:"

echo "$RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
preds = sorted(data.get('predictions', []), key=lambda x: x['probability'], reverse=True)[:3]
for i, p in enumerate(preds, 1):
    bar = chr(9608) * int(p['probability'] * 20)
    print(f'  #{i} {p[\"tagName\"]:15} {p[\"probability\"]*100:5.1f}% {bar}')
" 2>/dev/null || echo "  Could not parse response"

echo ""
echo "Raw:"
echo "$RESULT" | python3 -m json.tool 2>/dev/null || echo "$RESULT"
