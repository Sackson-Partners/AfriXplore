#!/bin/bash
##
# Deployment Status Monitor
# Check status of infrastructure and builds
##

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  AIN Platform - Deployment Status${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check infrastructure deployment
echo -e "${YELLOW}📦 Infrastructure Deployment:${NC}"
INFRA_STATE=$(az deployment group show \
  --resource-group rg-afrixplore-msim-prod \
  --name ain-prod-initial-* \
  --query properties.provisioningState -o tsv 2>/dev/null || echo "Unknown")

if [ "$INFRA_STATE" == "Succeeded" ]; then
  echo -e "   ${GREEN}✅ Succeeded${NC}"
elif [ "$INFRA_STATE" == "Running" ]; then
  echo -e "   ${YELLOW}⏳ Running...${NC}"
elif [ "$INFRA_STATE" == "Failed" ]; then
  echo -e "   ${RED}❌ Failed${NC}"
else
  echo -e "   ${YELLOW}⏳ In Progress...${NC}"
fi
echo ""

# Check ACR builds
echo -e "${YELLOW}🐳 ACR Build Status:${NC}"
for IMAGE in msim-api geoswarm-api convergence-engine; do
  BUILD_STATUS=$(az acr task list-runs \
    --registry cracaindev \
    --query "[?contains(name, '$IMAGE')].status | [0]" -o tsv 2>/dev/null || echo "Unknown")

  if [ "$BUILD_STATUS" == "Succeeded" ]; then
    echo -e "   ${GREEN}✅${NC} $IMAGE: Succeeded"
  elif [ "$BUILD_STATUS" == "Running" ]; then
    echo -e "   ${YELLOW}⏳${NC} $IMAGE: Running..."
  elif [ "$BUILD_STATUS" == "Failed" ]; then
    echo -e "   ${RED}❌${NC} $IMAGE: Failed"
  else
    echo -e "   ${YELLOW}⏳${NC} $IMAGE: Queued/Starting..."
  fi
done
echo ""

# Check if Container Apps exist
echo -e "${YELLOW}🚀 Container Apps:${NC}"
if az containerapp show --name ca-msim-api-prod --resource-group rg-afrixplore-msim-prod &>/dev/null; then
  CA_STATUS=$(az containerapp show \
    --name ca-msim-api-prod \
    --resource-group rg-afrixplore-msim-prod \
    --query properties.provisioningState -o tsv)
  echo -e "   ${GREEN}✅${NC} ca-msim-api-prod: $CA_STATUS"
else
  echo -e "   ${YELLOW}⏳${NC} ca-msim-api-prod: Not deployed yet"
fi
echo ""

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Next Steps:${NC}"
if [ "$INFRA_STATE" != "Succeeded" ]; then
  echo "  1. Wait for infrastructure deployment (60-90 min)"
  echo "  2. Run this script again to check status"
else
  echo "  1. ✅ Infrastructure ready"
  echo "  2. Wait for ACR builds to complete (15-20 min)"
  echo "  3. Deploy Container Apps"
fi
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
