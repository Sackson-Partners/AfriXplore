#!/bin/bash
# AfriXplore — Git pull + commit all fixes + push to staging

set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

log_step() { echo -e "\n${BOLD}${BLUE}▶ $1${NC}"; }
log_ok()   { echo -e "${GREEN}  ✅ $1${NC}"; }
log_warn() { echo -e "${YELLOW}  ⚠️  $1${NC}"; }
log_err()  { echo -e "${RED}  ❌ $1${NC}"; exit 1; }

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   AfriXplore — Git Push + Full Platform Deploy          ║"
echo "║   Sackson-Partners/AfriXplore                          ║"
echo "╚══════════════════════════════════════════════════════════╝"

# ─── PREFLIGHT ───────────────────────────────────────────────────────────────
log_step "Preflight checks"

command -v git    &>/dev/null || log_err "git not installed"
command -v gh     &>/dev/null || log_err "GitHub CLI not installed: brew install gh"
command -v docker &>/dev/null || log_err "Docker not installed"
command -v az     &>/dev/null || log_err "Azure CLI not installed: brew install azure-cli"
command -v vercel &>/dev/null || log_err "Vercel CLI not installed: npm i -g vercel"
command -v pnpm   &>/dev/null || log_err "pnpm not installed: npm i -g pnpm"

az account show &>/dev/null  || log_err "Not logged in to Azure. Run: az login"
gh auth status  &>/dev/null  || log_err "Not logged in to GitHub CLI. Run: gh auth login"
vercel whoami   &>/dev/null  || log_err "Not logged in to Vercel. Run: vercel login"

log_ok "All CLI tools authenticated"

# ─── STEP 1: PULL LATEST ─────────────────────────────────────────────────────
log_step "Step 1: Pull latest from remote"

BRANCH=$(git branch --show-current)
log_ok "Current branch: $BRANCH"

git fetch origin
git pull origin "$BRANCH" --rebase 2>&1 | tail -3
log_ok "Pulled latest from origin/$BRANCH"

# ─── STEP 2: INSTALL DEPENDENCIES ────────────────────────────────────────────
log_step "Step 2: Install / sync all dependencies"

pnpm install 2>&1 | tail -5
log_ok "pnpm install complete"

# ─── STEP 3: TYPE CHECK ──────────────────────────────────────────────────────
log_step "Step 3: TypeScript type check (all services)"

TS_ERRORS=0
for service in scout-api intelligence-api msim-api \
               notification-service payment-service; do
  printf "  Checking %-30s" "$service..."
  if (cd "services/$service" && npx tsc --noEmit 2>/dev/null); then
    echo -e "${GREEN}✅${NC}"
  else
    echo -e "${RED}❌ errors${NC}"
    ((TS_ERRORS++)) || true
  fi
done

if [ "$TS_ERRORS" -gt 0 ]; then
  log_warn "$TS_ERRORS service(s) have TypeScript errors"
  read -p "  Continue anyway? [y/N]: " -n 1 -r; echo
  [[ $REPLY =~ ^[Yy]$ ]] || exit 1
fi

# ─── STEP 4: BUILD ALL PACKAGES ──────────────────────────────────────────────
log_step "Step 4: Build all packages via Turborepo"

pnpm turbo build 2>&1 | tail -10
log_ok "Turborepo build complete"

# ─── STEP 5: STAGE ALL CHANGES ───────────────────────────────────────────────
log_step "Step 5: Stage all changes"

git add -A

CHANGED=$(git diff --cached --name-only | wc -l | tr -d ' ')
echo "  Staged $CHANGED files:"
git diff --cached --name-only | sed 's/^/    /'

if [ "$CHANGED" -eq 0 ]; then
  log_ok "No changes to commit — working tree clean"
  exit 0
fi

# ─── STEP 6: COMMIT ──────────────────────────────────────────────────────────
log_step "Step 6: Commit"

TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M UTC")

git commit -m "$(cat <<EOF
fix: all diagnostics resolved + platform hardening

Fixes applied:
- Zod v3: .errors -> .issues in all ZodError catch blocks
- Workspace imports: local inline implementations per service
- paymentConsumer.ts: Service Bus peekLock consumer
- tsconfig.json: @types/node auto-discovery (removed explicit types:[node])

Platform additions:
- services/intelligence-api: complete index.ts, clusters.ts, stream.ts
- services/notification-service: anomalyConsumer, paymentConsumer,
  signalrService, smsService, fcmService
- infrastructure/scripts: full CI/CD orchestration suite
- infrastructure/scripts/launch: production-launch.sh

Built: $TIMESTAMP
Repo:  Sackson-Partners/AfriXplore
EOF
)"

COMMIT_SHA=$(git rev-parse HEAD)
log_ok "Committed: ${COMMIT_SHA:0:12}"

# ─── STEP 7: PUSH ────────────────────────────────────────────────────────────
log_step "Step 7: Push to origin"

git push origin "$BRANCH"
log_ok "Pushed to origin/$BRANCH"

echo ""
echo "  SHA: $COMMIT_SHA"
echo "  View: https://github.com/Sackson-Partners/AfriXplore/commit/${COMMIT_SHA:0:12}"
