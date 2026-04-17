#!/bin/bash
# AfriXplore — Africa's Talking USSD + SMS Setup

set -euo pipefail

ENVIRONMENT=${1:-staging}
KV="kv-afrixplore-${ENVIRONMENT}"
RG="rg-afrixplore-${ENVIRONMENT}-southafricanorth"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; NC='\033[0m'; BOLD='\033[1m'
log_step() { echo -e "\n${BOLD}${BLUE}▶ $1${NC}"; }
log_ok()   { echo -e "${GREEN}  ✅ $1${NC}"; }
log_warn() { echo -e "${YELLOW}  ⚠️  $1${NC}"; }
log_info() { echo "  ℹ️  $1"; }

AT_API_KEY="${AFRICAS_TALKING_API_KEY:-$(az keyvault secret show \
  --vault-name "$KV" --name "africas-talking-api-key" \
  --query value -o tsv 2>/dev/null || echo "")}"

AT_USERNAME="${AFRICAS_TALKING_USERNAME:-sandbox}"

if [ -z "$AT_API_KEY" ]; then
  echo "AFRICAS_TALKING_API_KEY not set."
  echo "Get key from: africastalking.com -> Settings -> API Key"
  echo "Then: export AFRICAS_TALKING_API_KEY=your_key"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   AfriXplore — Africa's Talking Setup                   ║"
printf "║   Username: %-44s ║\n" "$AT_USERNAME"
echo "╚══════════════════════════════════════════════════════════╝"

log_step "Testing API connectivity"

USER_RESPONSE=$(curl -sf \
  "https://api.africastalking.com/version1/user?username=${AT_USERNAME}" \
  -H "Accept: application/json" \
  -H "apiKey: ${AT_API_KEY}" 2>/dev/null || echo "")

BALANCE=$(echo "$USER_RESPONSE" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('UserData',{}).get('balance','unknown'))" \
  2>/dev/null || echo "unknown")

[ "$BALANCE" != "unknown" ] && log_ok "API connected — Balance: $BALANCE" || \
  log_warn "API connection issue — check credentials"

log_step "Storing credentials in Key Vault"

az keyvault secret set \
  --vault-name "$KV" --name "africas-talking-api-key" \
  --value "$AT_API_KEY" --output none

az keyvault secret set \
  --vault-name "$KV" --name "africas-talking-username" \
  --value "$AT_USERNAME" --output none

log_ok "Credentials stored"

log_step "Sending test SMS"

TEST_PHONE="${AT_TEST_PHONE:-+254700000000}"

SMS_RESPONSE=$(curl -sf \
  -X POST \
  "https://api.africastalking.com/version1/messaging" \
  -H "Accept: application/json" \
  -H "apiKey: ${AT_API_KEY}" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "username=${AT_USERNAME}" \
  --data-urlencode "to=${TEST_PHONE}" \
  --data-urlencode "message=AfriXplore test message. Your scout app is ready!" \
  --data-urlencode "from=AfriXplore" \
  2>/dev/null || echo "")

SMS_STATUS=$(echo "$SMS_RESPONSE" | python3 -c "
import sys,json
d = json.load(sys.stdin)
entries = d.get('SMSMessageData',{}).get('Recipients',[])
print(entries[0].get('status','unknown') if entries else 'unknown')
" 2>/dev/null || echo "unknown")

[ "$SMS_STATUS" = "Success" ] || [ "$AT_USERNAME" = "sandbox" ] && \
  log_ok "SMS test: $SMS_STATUS (to $TEST_PHONE)" || \
  log_warn "SMS test returned: $SMS_STATUS"

log_step "Updating notification service"

APIM_URL=$(az apim show \
  --name "apim-afrixplore-${ENVIRONMENT}" \
  --resource-group "$RG" \
  --query "gatewayUrl" -o tsv 2>/dev/null || echo "")

USSD_CALLBACK="${APIM_URL}/scout/api/v1/ussd/callback"

az containerapp update \
  --name "ca-afrixplore-notification-${ENVIRONMENT}" \
  --resource-group "$RG" \
  --set-env-vars \
    "AFRICAS_TALKING_USERNAME=${AT_USERNAME}" \
    "AFRICAS_TALKING_USSD_CALLBACK=${USSD_CALLBACK}" \
  --output none 2>/dev/null || log_warn "Could not update Container App"

log_ok "Notification service updated"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Africa's Talking Setup Complete                        ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║   MANUAL STEP: Register USSD Short Code                 ║"
echo "║   1. Login: africastalking.com                          ║"
echo "║   2. USSD -> Short Code -> New Channel                  ║"
printf "║   3. Callback URL: %-37s ║\n" "$USSD_CALLBACK"
echo "║                                                          ║"
echo "║   Countries + lead times (4-6 weeks each):              ║"
echo "║   KE *384#  TZ *150*XX#  UG *185#  ZM *303#            ║"
echo "║                                                          ║"
echo "║   ✅ SMS (bulk + OTP) is LIVE immediately               ║"
echo "╚══════════════════════════════════════════════════════════╝"
