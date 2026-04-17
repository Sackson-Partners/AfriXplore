#!/bin/bash
# AfriXplore — Master orchestrator
# RUN: ./infrastructure/scripts/deploy-all.sh staging
# Does: git → CI watch → Docker/ACR → Azure → Vercel → integration tests → PR

set -euo pipefail

ENVIRONMENT=${1:-staging}
SCRIPTS="infrastructure/scripts"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

section() {
  echo ""
  echo -e "${BOLD}${BLUE}"
  echo "════════════════════════════════════════════════════════════"
  printf "  %s\n" "$1"
  echo "════════════════════════════════════════════════════════════"
  echo -e "${NC}"
}

OVERALL_START=$(date +%s)

echo ""
echo -e "${BOLD}${GREEN}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║     AfriXplore — Full Platform Deploy                   ║"
echo "║     git → ACR → Azure → Vercel → Tests                 ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Make all scripts executable
chmod +x "$SCRIPTS"/*.sh "$SCRIPTS"/debug/*.sh "$SCRIPTS"/launch/*.sh 2>/dev/null || true

# ── STAGE 1 ───────────────────────────────────────────────────────────────────
section "Stage 1/6 — Git Pull + Commit + Push"
bash "$SCRIPTS/git-push-all.sh"

# ── STAGE 2 ───────────────────────────────────────────────────────────────────
section "Stage 2/6 — Watch GitHub Actions CI"
bash "$SCRIPTS/watch-ci.sh" "$ENVIRONMENT"

# ── STAGE 3 ───────────────────────────────────────────────────────────────────
section "Stage 3/6 — Docker Build + Push to ACR"
bash "$SCRIPTS/docker-build-push.sh" "$ENVIRONMENT"

# ── STAGE 4 ───────────────────────────────────────────────────────────────────
section "Stage 4/6 — Deploy to Azure Container Apps"
bash "$SCRIPTS/deploy-azure.sh" "$ENVIRONMENT"

# ── STAGE 5 ───────────────────────────────────────────────────────────────────
section "Stage 5/6 — Deploy to Vercel"
bash "$SCRIPTS/deploy-vercel.sh" "$ENVIRONMENT"

# ── STAGE 6 ───────────────────────────────────────────────────────────────────
section "Stage 6/6 — Integration Tests"
bash "$SCRIPTS/integration-tests.sh" "$ENVIRONMENT"

# ── SUMMARY ───────────────────────────────────────────────────────────────────
TOTAL_TIME=$(($(date +%s) - OVERALL_START))
MINUTES=$((TOTAL_TIME / 60))
SECONDS_REM=$((TOTAL_TIME % 60))

BRANCH=$(git branch --show-current)
COMMIT=$(git rev-parse --short HEAD)

echo ""
echo -e "${BOLD}${GREEN}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║     AfriXplore FULLY DEPLOYED                           ║"
echo "╠══════════════════════════════════════════════════════════╣"
printf "║     Total time:  %dm %ds                                ║\n" "$MINUTES" "$SECONDS_REM"
printf "║     Branch:      %-40s ║\n" "$BRANCH"
printf "║     Commit:      %-40s ║\n" "$COMMIT"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║     Platform:    https://platform.afrixplore.io         ║"
echo "║     Admin:       https://admin.afrixplore.io            ║"
echo "║     API:         https://api.afrixplore.io              ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║     Monitor:                                             ║"
echo "║     github.com/Sackson-Partners/AfriXplore/actions      ║"
printf "║     portal.azure.com -> appi-afrixplore-%-17s ║\n" "$ENVIRONMENT"
echo "║     vercel.com/sackson-partners                         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── PR TO MAIN ────────────────────────────────────────────────────────────────
if [ "$ENVIRONMENT" = "staging" ]; then
  echo ""
  read -p "  Staging looks good — create PR to main? [y/N]: " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    gh pr create \
      --repo "Sackson-Partners/AfriXplore" \
      --base main \
      --head staging \
      --title "Deploy: all diagnostics fixed + platform hardened [$(date +%Y-%m-%d)]" \
      --body "$(cat <<'PRBODY'
## Summary
- All TypeScript diagnostics resolved
- Full CI/CD pipeline validated on staging
- Azure Container Apps: all 6 services healthy
- Vercel: platform-web + admin-web deployed
- Integration tests: all passing

## Changes
- Zod v3: `.errors` -> `.issues` in ZodError catch blocks
- Workspace imports replaced with local inline implementations
- `paymentConsumer.ts`: Service Bus peekLock consumer
- tsconfig: `@types/node` auto-discovery restored
- CI/CD: full orchestration scripts added

## Test Results
- GitHub Actions CI: passing
- Docker/ACR: all 6 images built and pushed
- Azure health checks: all passing
- Integration tests: all groups passing
PRBODY
)" \
      --assignee "@me"

    echo ""
    echo "  PR created -> github.com/Sackson-Partners/AfriXplore/pulls"
    echo "  Merge to trigger production blue-green deploy"
  fi
fi
