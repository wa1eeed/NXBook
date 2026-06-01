#!/bin/sh
# Production startup — run pending migrations then start the app.
# Coolify sets CMD to ["node","server.js"]; we override it with this script.
set -e

echo "[start] Running prisma migrate deploy..."
npx prisma migrate deploy

echo "[start] Starting Next.js..."
exec node server.js
