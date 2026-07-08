#!/usr/bin/env bash
# ============================================================
# AIN Platform Local Dev Startup — MSIM + GeoSwarm
# ============================================================
# Prerequisites:
#   - PostgreSQL running: docker compose up -d
#   - pnpm@9.4.0 installed
#   - Python 3.11+ with convergence-engine venv set up:
#       cd services/convergence-engine && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
#
# Services started:
#   5001  platform-web    (MSIM subscriber dashboard)
#   5002  msim-api        (MSIM data API)
#   5003  geoswarm-api    (GeoSwarm API)
#   5004  geoswarm-web    (GeoSwarm dashboard)
#   5005  convergence-engine (FastAPI DPI scoring)
#   5006  admin-web       (admin panel)
# ============================================================

set -e
ulimit -n 65536 2>/dev/null || true

REPO="$(cd "$(dirname "$0")" && pwd)"
PIDS=()

cleanup() {
  echo ""
  echo "Stopping all dev processes..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null
  echo "Done."
}
trap cleanup EXIT INT TERM

cd "$REPO"

# ── Verify Azure DB is reachable ────────────────────────────────────────────
echo "Checking Azure PostgreSQL..."
if ! PGPASSWORD="c5477733-b522-41f8-80ff-7c16f6a34c90" psql \
    "postgresql://afrixploreAdmin@psql-afrixplore-staging-saf.postgres.database.azure.com:5432/afrixplore?sslmode=require" \
    -c "SELECT 1" -q > /dev/null 2>&1; then
  echo "ERROR: Cannot reach Azure PostgreSQL — check your internet connection or firewall rules"
  exit 1
fi
echo "  ✓ Azure PostgreSQL OK"

# ── Install deps if needed ──────────────────────────────────────────────────
echo "Installing pnpm deps..."
pnpm install --frozen-lockfile --silent

# ── Run DB migrations ────────────────────────────────────────────────────────
echo "Running DB migrations..."
pnpm db:migrate 2>&1 | tail -5 || echo "  (migration skipped or already up-to-date)"

# ── Start Node.js APIs ──────────────────────────────────────────────────────
echo "Starting @ain/msim-api on :5002..."
pnpm --filter "@ain/msim-api" dev 2>&1 | sed 's/^/[msim-api] /' &
PIDS+=($!)

echo "Starting @ain/geoswarm-api on :5003..."
pnpm --filter "@ain/geoswarm-api" dev 2>&1 | sed 's/^/[geoswarm-api] /' &
PIDS+=($!)

# ── Start convergence-engine (Python FastAPI) ────────────────────────────────
VENV="$REPO/services/convergence-engine/.venv"
if [ -d "$VENV" ]; then
  echo "Starting convergence-engine on :5005..."
  (
    cd "$REPO/services/convergence-engine"
    .venv/bin/uvicorn src.main:app --host 0.0.0.0 --port 5005 --reload 2>&1 | sed 's/^/[convergence] /'
  ) &
  PIDS+=($!)
else
  echo "WARNING: convergence-engine venv not found — skipping"
  echo "  Run: cd services/convergence-engine && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
fi

# ── Start Next.js apps (port-override via -p flag) ──────────────────────────
echo "Starting platform-web (MSIM) on :5001..."
(cd "$REPO/apps/platform-web" && npx next dev -p 5001 2>&1 | sed 's/^/[platform-web] /') &
PIDS+=($!)

echo "Starting geoswarm-web on :5004..."
(cd "$REPO/apps/geoswarm-web" && npx next dev -p 5004 2>&1 | sed 's/^/[geoswarm-web] /') &
PIDS+=($!)

echo "Starting admin-web on :5006..."
(cd "$REPO/apps/admin-web" && npx next dev -p 5006 2>&1 | sed 's/^/[admin-web] /') &
PIDS+=($!)

# ── Print service map ────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo " AIN Platform — LOCAL DEV  (MSIM + GeoSwarm)"
echo "═══════════════════════════════════════════════════════"
echo "  MSIM"
echo "    platform-web     → http://localhost:5001   ← open this"
echo "    msim-api         → http://localhost:5002"
echo "    convergence-eng  → http://localhost:5005"
echo ""
echo "  GeoSwarm"
echo "    geoswarm-web     → http://localhost:5004   ← open this"
echo "    geoswarm-api     → http://localhost:5003"
echo ""
echo "  Admin"
echo "    admin-web        → http://localhost:5006"
echo "═══════════════════════════════════════════════════════"
echo "  DB               → postgresql://localhost:5433/ain"
echo "  Auth             → DEV_BYPASS_AUTH=true (no token needed)"
echo "═══════════════════════════════════════════════════════"
echo "  Press Ctrl+C to stop all services"
echo ""

wait
