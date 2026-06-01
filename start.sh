#!/bin/sh
# Production startup — migrate then start Next.js.
# Uses node directly to invoke prisma CLI (avoids npx/PATH issues
# in the standalone runner and ensures wasm files are found).

echo "[start] DATABASE_URL prefix: $(echo "$DATABASE_URL" | cut -c1-35)..."

echo "[start] Running prisma migrate deploy..."
node node_modules/prisma/build/index.js migrate deploy
EXIT=$?
if [ $EXIT -ne 0 ]; then
  echo "[start] WARNING: migrate deploy exited $EXIT — starting server anyway"
else
  echo "[start] Migrations applied OK"
fi

echo "[start] Starting Next.js on :${PORT:-3000}..."
exec node server.js
