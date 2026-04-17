#!/bin/bash
# AfriXplore — Custom Vision Full Setup
# Creates project, tags, uploads seed images, trains + publishes

set -euo pipefail

ENVIRONMENT=${1:-staging}
RG="rg-afrixplore-${ENVIRONMENT}-southafricanorth"
KV="kv-afrixplore-${ENVIRONMENT}"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'
RED='\033[0;31m'; NC='\033[0m'; BOLD='\033[1m'
log_step() { echo -e "\n${BOLD}${BLUE}▶ $1${NC}"; }
log_ok()   { echo -e "${GREEN}  ✅ $1${NC}"; }
log_warn() { echo -e "${YELLOW}  ⚠️  $1${NC}"; }
log_err()  { echo -e "${RED}  ❌ $1${NC}"; exit 1; }
log_info() { echo "  ℹ️  $1"; }

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   AfriXplore — Custom Vision Project Setup              ║"
printf "║   Environment: %-42s ║\n" "$ENVIRONMENT"
echo "╚══════════════════════════════════════════════════════════╝"

log_step "Fetching credentials from Key Vault"

CV_TRAINING_KEY=$(az keyvault secret show \
  --vault-name "$KV" --name "custom-vision-training-key" \
  --query value -o tsv 2>/dev/null || echo "")

CV_TRAINING_ENDPOINT=$(az cognitiveservices account show \
  --name "cv-afrixplore-training-${ENVIRONMENT}" \
  --resource-group "$RG" \
  --query "properties.endpoint" -o tsv 2>/dev/null || echo "")

CV_PREDICTION_KEY=$(az keyvault secret show \
  --vault-name "$KV" --name "custom-vision-prediction-key" \
  --query value -o tsv 2>/dev/null || echo "")

CV_PREDICTION_ENDPOINT=$(az cognitiveservices account show \
  --name "cv-afrixplore-prediction-${ENVIRONMENT}" \
  --resource-group "$RG" \
  --query "properties.endpoint" -o tsv 2>/dev/null || echo "")

CV_PREDICTION_RESOURCE_ID=$(az cognitiveservices account show \
  --name "cv-afrixplore-prediction-${ENVIRONMENT}" \
  --resource-group "$RG" \
  --query "id" -o tsv 2>/dev/null || echo "")

[ -z "$CV_TRAINING_KEY" ] || [ -z "$CV_TRAINING_ENDPOINT" ] && \
  log_err "Cannot fetch Custom Vision credentials from Key Vault"

log_ok "Training endpoint: $CV_TRAINING_ENDPOINT"

log_step "Creating Custom Vision project"

PROJECT_RESPONSE=$(curl -sf \
  -X POST \
  "${CV_TRAINING_ENDPOINT}customvision/v3.3/Training/projects" \
  -H "Training-Key: ${CV_TRAINING_KEY}" \
  -H "Content-Type: application/json" \
  --data-raw '{
    "name": "AfriXplore Mineral ID",
    "description": "African ore mineral classification — 21 mineral types",
    "classificationType": "Multiclass",
    "targetExportPlatforms": ["TensorFlow", "CoreML"]
  }' 2>/dev/null || echo "")

if [ -z "$PROJECT_RESPONSE" ]; then
  log_warn "Project creation returned empty — checking for existing project"
  PROJECT_RESPONSE=$(curl -sf \
    "${CV_TRAINING_ENDPOINT}customvision/v3.3/Training/projects" \
    -H "Training-Key: ${CV_TRAINING_KEY}" 2>/dev/null | \
    python3 -c "
import sys, json
projects = json.load(sys.stdin)
for p in projects:
    if 'AfriXplore' in p.get('name',''):
        print(json.dumps(p))
        break
" || echo "")
fi

PROJECT_ID=$(echo "$PROJECT_RESPONSE" | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")

[ -z "$PROJECT_ID" ] && log_err "Failed to create or find Custom Vision project"
log_ok "Project ID: $PROJECT_ID"

log_step "Creating mineral classification tags"

MINERALS=(
  "copper" "cobalt" "lithium" "nickel" "manganese"
  "gold" "platinum" "palladium" "chrome" "graphite"
  "tin" "tungsten" "coltan" "bauxite" "uranium"
  "ree" "quartz" "feldspar" "pyrite" "malachite" "galena"
)

declare -A TAG_IDS

for MINERAL in "${MINERALS[@]}"; do
  TAG_RESPONSE=$(curl -sf \
    -X POST \
    "${CV_TRAINING_ENDPOINT}customvision/v3.3/Training/projects/${PROJECT_ID}/tags" \
    -H "Training-Key: ${CV_TRAINING_KEY}" \
    -G --data-urlencode "name=${MINERAL}" 2>/dev/null || echo "")

  TAG_ID=$(echo "$TAG_RESPONSE" | \
    python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" \
    2>/dev/null || echo "")

  if [ -n "$TAG_ID" ]; then
    TAG_IDS[$MINERAL]="$TAG_ID"
    log_ok "Tag: $MINERAL -> $TAG_ID"
  else
    log_warn "Tag may already exist: $MINERAL"
  fi
done

log_step "Storing project config in Key Vault"

az keyvault secret set \
  --vault-name "$KV" --name "custom-vision-project-id" \
  --value "$PROJECT_ID" --output none

az keyvault secret set \
  --vault-name "$KV" --name "custom-vision-prediction-resource-id" \
  --value "$CV_PREDICTION_RESOURCE_ID" --output none

log_ok "Project ID stored in Key Vault"

log_step "Updating Container Apps"

for APP in \
  "ca-afrixplore-geo-worker-${ENVIRONMENT}" \
  "ca-afrixplore-scout-api-${ENVIRONMENT}"; do

  az containerapp update \
    --name "$APP" --resource-group "$RG" \
    --set-env-vars \
      "CUSTOM_VISION_PROJECT_ID=${PROJECT_ID}" \
      "CUSTOM_VISION_TRAINING_ENDPOINT=${CV_TRAINING_ENDPOINT}" \
      "CUSTOM_VISION_PREDICTION_ENDPOINT=${CV_PREDICTION_ENDPOINT}" \
      "CUSTOM_VISION_PUBLISHED_NAME=mineral-id-v1" \
    --output none 2>/dev/null || log_warn "Could not update $APP"
  log_ok "Updated: $APP"
done

log_step "Checking for seed images"

SEED_DIR="infrastructure/assets/seed-images"

if [ -d "$SEED_DIR" ]; then
  IMAGE_COUNT_TOTAL=0

  for MINERAL in "${MINERALS[@]}"; do
    MINERAL_DIR="$SEED_DIR/$MINERAL"
    TAG_ID="${TAG_IDS[$MINERAL]:-}"

    [ -z "$TAG_ID" ] && continue

    COUNT=$(find "$MINERAL_DIR" -name "*.jpg" -o -name "*.jpeg" \
      -o -name "*.png" 2>/dev/null | wc -l | tr -d ' ')

    [ "$COUNT" -eq 0 ] && continue

    log_info "Uploading $COUNT images for $MINERAL..."
    IMAGE_COUNT_TOTAL=$((IMAGE_COUNT_TOTAL + COUNT))

    # Process in batches of 64
    IMAGES=()
    while IFS= read -r -d '' IMG; do
      IMAGES+=("$IMG")
    done < <(find "$MINERAL_DIR" \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" \) -print0 2>/dev/null)

    BATCH_SIZE=64
    for ((i=0; i<${#IMAGES[@]}; i+=BATCH_SIZE)); do
      BATCH=("${IMAGES[@]:$i:$BATCH_SIZE}")
      PAYLOAD='{"images":['
      for IMG in "${BATCH[@]}"; do
        B64=$(base64 < "$IMG" | tr -d '\n')
        FNAME=$(basename "$IMG")
        PAYLOAD="${PAYLOAD}{\"name\":\"${FNAME}\",\"contents\":\"${B64}\",\"tagIds\":[\"${TAG_ID}\"]},"
      done
      PAYLOAD="${PAYLOAD%,}]}"
      curl -sf \
        -X POST \
        "${CV_TRAINING_ENDPOINT}customvision/v3.3/Training/projects/${PROJECT_ID}/images/image" \
        -H "Training-Key: ${CV_TRAINING_KEY}" \
        -H "Content-Type: application/json" \
        --data "$PAYLOAD" > /dev/null 2>&1 || true
    done
    log_ok "Uploaded: $MINERAL ($COUNT images)"
  done

  if [ "$IMAGE_COUNT_TOTAL" -ge 20 ]; then
    log_step "Triggering initial training"

    TRAIN_RESPONSE=$(curl -sf \
      -X POST \
      "${CV_TRAINING_ENDPOINT}customvision/v3.3/Training/projects/${PROJECT_ID}/train" \
      -H "Training-Key: ${CV_TRAINING_KEY}" \
      -H "Content-Length: 0" 2>/dev/null || echo "")

    ITERATION_ID=$(echo "$TRAIN_RESPONSE" | \
      python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" \
      2>/dev/null || echo "")

    if [ -n "$ITERATION_ID" ]; then
      log_ok "Training started — Iteration: $ITERATION_ID"
      az keyvault secret set \
        --vault-name "$KV" --name "custom-vision-iteration-id" \
        --value "$ITERATION_ID" --output none
    else
      log_warn "Training could not start — may need more images per tag (5+ per class)"
    fi
  else
    log_warn "Not enough images ($IMAGE_COUNT_TOTAL) — need at least 20 total"
  fi
else
  log_warn "Seed images directory not found — creating structure"
  for MINERAL in "${MINERALS[@]}"; do
    mkdir -p "$SEED_DIR/$MINERAL"
  done
  log_info "Add at least 5 images per mineral to: $SEED_DIR/<mineral>/"
  log_info "Then re-run this script to upload and train"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Custom Vision Setup Summary                           ║"
echo "╠══════════════════════════════════════════════════════════╣"
printf "║   Project ID:  %-41s ║\n" "$PROJECT_ID"
printf "║   Tags:        %-3d minerals configured                  ║\n" "${#MINERALS[@]}"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║   Next:  add images to infrastructure/assets/           ║"
echo "║          seed-images/<mineral>/*.jpg then re-run        ║"
echo "╚══════════════════════════════════════════════════════════╝"
