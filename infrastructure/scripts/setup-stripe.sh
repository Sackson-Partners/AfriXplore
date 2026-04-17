#!/bin/bash
# AfriXplore — Stripe Webhook + Product Setup

set -euo pipefail

ENVIRONMENT=${1:-staging}
RG="rg-afrixplore-${ENVIRONMENT}-southafricanorth"
KV="kv-afrixplore-${ENVIRONMENT}"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'; BOLD='\033[1m'
log_step() { echo -e "\n${BOLD}${BLUE}▶ $1${NC}"; }
log_ok()   { echo -e "${GREEN}  ✅ $1${NC}"; }
log_info() { echo "  ℹ️  $1"; }
log_warn() { echo "  ⚠️  $1"; }

APIM_URL=$(az apim show \
  --name "apim-afrixplore-${ENVIRONMENT}" \
  --resource-group "$RG" \
  --query "gatewayUrl" -o tsv 2>/dev/null || echo "")

WEBHOOK_URL="${APIM_URL}/payments/webhooks/stripe"

STRIPE_KEY="${STRIPE_SECRET_KEY:-$(az keyvault secret show \
  --vault-name "$KV" --name "stripe-secret-key" \
  --query value -o tsv 2>/dev/null || echo "")}"

if [ -z "$STRIPE_KEY" ]; then
  echo "STRIPE_SECRET_KEY not set. Export it first:"
  echo "  export STRIPE_SECRET_KEY=sk_test_..."
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   AfriXplore — Stripe Configuration                     ║"
printf "║   Webhook: %-45s ║\n" "$WEBHOOK_URL"
echo "╚══════════════════════════════════════════════════════════╝"

log_step "Creating Stripe webhook endpoint"

WEBHOOK_RESPONSE=$(curl -sf \
  https://api.stripe.com/v1/webhook_endpoints \
  -u "${STRIPE_KEY}:" \
  -d "url=${WEBHOOK_URL}" \
  -d "enabled_events[]=customer.subscription.created" \
  -d "enabled_events[]=customer.subscription.updated" \
  -d "enabled_events[]=customer.subscription.deleted" \
  -d "enabled_events[]=invoice.payment_succeeded" \
  -d "enabled_events[]=invoice.payment_failed" \
  -d "enabled_events[]=customer.subscription.trial_will_end" \
  -d "description=AfriXplore ${ENVIRONMENT} webhook" \
  2>/dev/null || echo "")

WEBHOOK_ID=$(echo "$WEBHOOK_RESPONSE" | \
  python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" \
  2>/dev/null || echo "")

WEBHOOK_SECRET=$(echo "$WEBHOOK_RESPONSE" | \
  python3 -c "import sys,json; print(json.load(sys.stdin).get('secret',''))" \
  2>/dev/null || echo "")

[ -n "$WEBHOOK_ID" ] && log_ok "Webhook created: $WEBHOOK_ID" || \
  log_warn "Webhook may already exist"

log_step "Creating Stripe products and prices"

create_product_and_price() {
  local NAME=$1 AMOUNT=$2 TIER=$3

  PRODUCT_ID=$(curl -sf https://api.stripe.com/v1/products \
    -u "${STRIPE_KEY}:" \
    -d "name=AfriXplore ${NAME}" \
    -d "metadata[tier]=${TIER}" \
    2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")

  [ -z "$PRODUCT_ID" ] && { log_warn "Could not create product: $NAME"; return; }

  PRICE_ID=$(curl -sf https://api.stripe.com/v1/prices \
    -u "${STRIPE_KEY}:" \
    -d "product=${PRODUCT_ID}" \
    -d "unit_amount=${AMOUNT}" \
    -d "currency=usd" \
    -d "recurring[interval]=year" \
    -d "metadata[tier]=${TIER}" \
    2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")

  log_ok "${NAME}: product=${PRODUCT_ID} price=${PRICE_ID}"

  [ -n "$PRICE_ID" ] && az keyvault secret set \
    --vault-name "$KV" --name "stripe-price-${TIER}" \
    --value "$PRICE_ID" --output none 2>/dev/null || true
}

create_product_and_price "Starter"      2500000  "starter"
create_product_and_price "Professional" 10000000 "professional"
create_product_and_price "Enterprise"   30000000 "enterprise"

log_step "Storing webhook secret"

if [ -n "$WEBHOOK_SECRET" ]; then
  az keyvault secret set \
    --vault-name "$KV" --name "stripe-webhook-secret" \
    --value "$WEBHOOK_SECRET" --output none

  az containerapp update \
    --name "ca-afrixplore-payment-${ENVIRONMENT}" \
    --resource-group "$RG" \
    --set-env-vars "STRIPE_WEBHOOK_SECRET=secretref:stripe-webhook-secret" \
    --output none 2>/dev/null || true

  log_ok "Webhook secret stored and payment service updated"
fi

if command -v stripe &>/dev/null; then
  stripe trigger customer.subscription.created --api-key "$STRIPE_KEY" 2>/dev/null && \
    log_ok "Test webhook triggered via Stripe CLI" || true
else
  log_info "Install Stripe CLI to test webhooks: brew install stripe/stripe-cli/stripe"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Stripe Setup Complete                                  ║"
printf "║   Webhook ID: %-43s ║\n" "$WEBHOOK_ID"
echo "║   Dashboard: https://dashboard.stripe.com/webhooks      ║"
echo "╚══════════════════════════════════════════════════════════╝"
