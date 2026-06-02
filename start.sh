#!/bin/sh
# Production startup — migrate then start Next.js.
# Uses node directly to invoke prisma CLI (avoids npx/PATH issues
# in the standalone runner and ensures wasm files are found).

set -e
PRISMA="node node_modules/prisma/build/index.js"

echo "[start] DATABASE_URL prefix: $(echo "$DATABASE_URL" | cut -c1-35)..."

# ── 1. Try migrate deploy ───────────────────────────────────
echo "[start] Running prisma migrate deploy..."
if $PRISMA migrate deploy; then
  echo "[start] Migrations applied OK"
else
  EXIT=$?
  echo "[start] migrate deploy exited $EXIT — attempting auto-recovery"

  # Prisma marks a partially-applied migration as `failed` in the
  # `_prisma_migrations` table. Future `migrate deploy` calls refuse
  # to run until that row is resolved. We mark any failed migrations
  # as rolled-back and retry once; the new migration SQL is written
  # to be idempotent, so the retry will either re-apply cleanly or
  # confirm everything is already in place.
  FAILED=$(node -e "
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    p.\$queryRaw\`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL\`
      .then(r => { console.log(r.map(x => x.migration_name).join('\n')); process.exit(0); })
      .catch(e => { console.error('lookup failed:', e.message); process.exit(0); });
  " 2>/dev/null || true)

  if [ -n "$FAILED" ]; then
    echo "[start] Marking failed migrations as rolled-back: $FAILED"
    for m in $FAILED; do
      $PRISMA migrate resolve --rolled-back "$m" || true
    done
    echo "[start] Retrying migrate deploy..."
    if $PRISMA migrate deploy; then
      echo "[start] Migrations applied OK after auto-recovery"
    else
      echo "[start] WARNING: migrate deploy STILL failing — starting server anyway"
    fi
  else
    echo "[start] WARNING: no failed migrations found but deploy failed — starting server anyway"
  fi
fi

echo "[start] Starting Next.js on :${PORT:-3000}..."
exec node server.js
