#!/bin/bash
# AfriXplore — Monitor GitHub Actions workflows in real time

set -euo pipefail

REPO="Sackson-Partners/AfriXplore"
BRANCH="${1:-staging}"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   AfriXplore — GitHub Actions Monitor                   ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  Branch: $BRANCH"
echo ""

# ─── WAIT FOR RUN TO APPEAR ──────────────────────────────────────────────────
echo "▶ Waiting for CI run to start..."
sleep 8

# ─── GET LATEST RUN ID ───────────────────────────────────────────────────────
RUN_ID=$(gh run list \
  --repo "$REPO" \
  --branch "$BRANCH" \
  --limit 1 \
  --json databaseId \
  --jq '.[0].databaseId' 2>/dev/null || echo "")

if [ -z "$RUN_ID" ]; then
  echo "  No run found on branch $BRANCH — triggering workflow check..."
  gh run list --repo "$REPO" --limit 5
  exit 0
fi

echo "  Run ID: $RUN_ID"
echo "  URL: https://github.com/$REPO/actions/runs/$RUN_ID"
echo ""

# ─── WATCH IN REAL TIME ──────────────────────────────────────────────────────
echo "▶ Watching run $RUN_ID (Ctrl+C to detach)..."
gh run watch "$RUN_ID" --repo "$REPO" --exit-status || RUN_STATUS=$?

# ─── SHOW FINAL STATUS ───────────────────────────────────────────────────────
echo ""
echo "▶ Run complete — job summary:"
gh run view "$RUN_ID" \
  --repo "$REPO" \
  --json jobs \
  --jq '.jobs[] | "  \(.conclusion // "running") — \(.name)"' 2>/dev/null || true

# ─── SHOW LOGS IF FAILED ─────────────────────────────────────────────────────
CONCLUSION=$(gh run view "$RUN_ID" \
  --repo "$REPO" \
  --json conclusion \
  --jq '.conclusion' 2>/dev/null || echo "unknown")

if [ "$CONCLUSION" != "success" ]; then
  echo ""
  echo "⚠️  Run did not succeed ($CONCLUSION) — showing failed job logs:"
  echo ""

  gh run view "$RUN_ID" \
    --repo "$REPO" \
    --log-failed 2>&1 | head -100 || true

  echo ""
  echo "Fix and re-run with:"
  echo "  gh run rerun $RUN_ID --repo $REPO --failed"
  exit 1
fi

echo ""
echo "✅ CI passed"
