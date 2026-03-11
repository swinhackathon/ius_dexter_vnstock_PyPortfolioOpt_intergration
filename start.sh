#!/bin/bash
# ============================================================
# start.sh — Startup script for App Runner Source Code mode
# Replaces supervisord: starts VNStock in background,
# then Dexter in foreground (App Runner monitors Dexter's PID)
# ============================================================

set -e

# Ensure Bun is on PATH (installed during build phase)
export PATH="/root/.bun/bin:$HOME/.bun/bin:$PATH"

echo "=== Starting VNStock API service (port 8050) ==="
python3 vnstock/vnstock_service.py &
VNSTOCK_PID=$!

# Wait up to 30s for VNStock to be ready
echo "Waiting for VNStock to be healthy..."
for i in $(seq 1 15); do
  if curl -sf http://localhost:8050/health > /dev/null 2>&1; then
    echo "✅ VNStock is ready (attempt $i)"
    break
  fi
  if [ $i -eq 15 ]; then
    echo "⚠️  VNStock did not respond in time — Dexter will still start"
    echo "    Vietnamese stock tools may return errors until VNStock is ready"
  fi
  sleep 2
done

# If VNStock crashed, log and continue (Dexter can still serve non-VN queries)
if ! kill -0 $VNSTOCK_PID 2>/dev/null; then
  echo "⚠️  VNStock process exited — check Python deps"
fi

echo "=== Starting Dexter HTTP server (port 3000) ==="
# Run Dexter in foreground — App Runner monitors this process
exec bun run dexter/src/server.ts
