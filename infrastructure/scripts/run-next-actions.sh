#!/bin/bash
# AfriXplore — Master next-actions orchestrator

set -euo pipefail

ENVIRONMENT=${1:-staging}
SCRIPTS="infrastructure/scripts"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'; BOLD='\033[1m'

section() {
  echo ""
  echo -e "${BOLD}${BLUE}════════════════════════════════════════════════════════════${NC}"
  printf "${BOLD}${BLUE}  %s${NC}\n" "$1"
  echo -e "${BOLD}${BLUE}════════════════════════════════════════════════════════════${NC}"
  echo ""
}

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   AfriXplore — Immediate Next Actions                   ║"
printf "║   Environment: %-42s ║\n" "$ENVIRONMENT"
echo "╚══════════════════════════════════════════════════════════╝"

chmod +x "$SCRIPTS"/*.sh "$SCRIPTS"/debug/*.sh "$SCRIPTS"/launch/*.sh 2>/dev/null || true

section "Action 1/5 — Deploy Platform ($ENVIRONMENT)"
bash "$SCRIPTS/deploy-all.sh" "$ENVIRONMENT"

section "Action 2/5 — Custom Vision Setup"
bash "$SCRIPTS/setup-custom-vision.sh" "$ENVIRONMENT"

section "Action 3/5 — Stripe Configuration"
bash "$SCRIPTS/setup-stripe.sh" "$ENVIRONMENT"

section "Action 4/5 — Africa's Talking Setup"
bash "$SCRIPTS/setup-africas-talking.sh" "$ENVIRONMENT"

section "Action 5/5 — End-to-End Tests"
bash "$SCRIPTS/test-e2e-scout.sh" "$ENVIRONMENT"

echo ""
echo -e "${BOLD}${GREEN}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   All Next Actions Complete                             ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║   Platform:    https://platform.afrixplore.io           ║"
echo "║   API:         https://api.afrixplore.io                ║"
echo "║   Admin:       https://admin.afrixplore.io              ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║   Manual steps still required:                          ║"
echo "║   [] Add mineral images to seed-images/ and retrain     ║"
echo "║   [] Apply for USSD short codes (4-6 weeks)             ║"
echo "║   [] Onboard first scouts in pilot district             ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
