#!/bin/sh
# Production startup script.
# Runs prisma migrate deploy (fail-open), then starts Next.js.

echo "[start] DATABASE_URL prefix: $(echo $DATABASE_URL | cut -c1-30)..."

echo "[start] Running prisma migrate deploy..."
if [ -f ./node_modules/.bin/prisma ]; then
  ./node_modules/.bin/prisma migrate deploy 2>&1
  EXIT=$?
  if [ $EXIT -ne 0 ]; then
    echo "[start] WARNING: migrate deploy exited with $EXIT — starting server anyway"
  else
    echo "[start] Migrations OK"
  fi
else
  echo "[start] prisma CLI not found — skipping migrations"
fi

echo "[start] Starting Next.js on port ${PORT:-3000}..."
exec node server.js
