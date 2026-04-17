#!/bin/bash
# Poll Custom Vision training status until complete

set -euo pipefail

ENVIRONMENT=${1:-staging}
KV="kv-afrixplore-${ENVIRONMENT}"
RG="rg-afrixplore-${ENVIRONMENT}-southafricanorth"

CV_TRAINING_KEY=$(az keyvault secret show \
  --vault-name "$KV" --name "custom-vision-training-key" \
  --query value -o tsv)

CV_TRAINING_ENDPOINT=$(az cognitiveservices account show \
  --name "cv-afrixplore-training-${ENVIRONMENT}" \
  --resource-group "$RG" \
  --query "properties.endpoint" -o tsv)

PROJECT_ID=$(az keyvault secret show \
  --vault-name "$KV" --name "custom-vision-project-id" \
  --query value -o tsv)

ITERATION_ID=$(az keyvault secret show \
  --vault-name "$KV" --name "custom-vision-iteration-id" \
  --query value -o tsv 2>/dev/null || echo "")

if [ -z "$ITERATION_ID" ]; then
  ITERATION_ID=$(curl -sf \
    "${CV_TRAINING_ENDPOINT}customvision/v3.3/Training/projects/${PROJECT_ID}/iterations" \
    -H "Training-Key: ${CV_TRAINING_KEY}" | \
    python3 -c "
import sys,json
iters = json.load(sys.stdin)
if iters:
    print(sorted(iters, key=lambda x: x.get('created',''), reverse=True)[0]['id'])
" 2>/dev/null || echo "")
fi

if [ -z "$ITERATION_ID" ]; then
  echo "No training iteration found. Run setup-custom-vision.sh first."
  exit 1
fi

echo "Monitoring training iteration: $ITERATION_ID"
echo "Press Ctrl+C to stop monitoring (training continues in background)"
echo ""

ATTEMPT=0
while true; do
  ((ATTEMPT++))

  RESPONSE=$(curl -sf \
    "${CV_TRAINING_ENDPOINT}customvision/v3.3/Training/projects/${PROJECT_ID}/iterations/${ITERATION_ID}" \
    -H "Training-Key: ${CV_TRAINING_KEY}" 2>/dev/null || echo "{}")

  STATUS=$(echo "$RESPONSE" | \
    python3 -c "import sys,json; print(json.load(sys.stdin).get('status','Unknown'))" \
    2>/dev/null || echo "Unknown")

  TS=$(date +"%H:%M:%S")

  case "$STATUS" in
    Training)
      printf "\r  [%s] Training in progress... (check %d)" "$TS" "$ATTEMPT"
      sleep 30
      ;;
    Completed)
      echo ""
      echo ""
      echo "  ✅ Training COMPLETE!"

      PERF=$(curl -sf \
        "${CV_TRAINING_ENDPOINT}customvision/v3.3/Training/projects/${PROJECT_ID}/iterations/${ITERATION_ID}/performance" \
        -H "Training-Key: ${CV_TRAINING_KEY}" \
        -G --data-urlencode "threshold=0.5" 2>/dev/null || echo "{}")

      python3 - <<'PYEOF'
import sys, json
with open('/dev/stdin') as f:
    pass
PYEOF
      echo "$PERF" | python3 -c "
import sys,json
d = json.load(sys.stdin)
prec = d.get('precision', 0) * 100
rec  = d.get('recall', 0) * 100
mAP  = d.get('averagePrecision', 0) * 100
print(f'  Precision: {prec:.1f}%')
print(f'  Recall:    {rec:.1f}%')
print(f'  mAP:       {mAP:.1f}%')
" 2>/dev/null || true

      echo ""
      echo "  Run to publish: ./infrastructure/scripts/publish-cv-model.sh $ENVIRONMENT"
      break
      ;;
    Failed)
      echo ""
      echo "  ❌ Training FAILED"
      echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
      exit 1
      ;;
    *)
      printf "\r  [%s] Status: %s (check %d)" "$TS" "$STATUS" "$ATTEMPT"
      sleep 15
      ;;
  esac
done
