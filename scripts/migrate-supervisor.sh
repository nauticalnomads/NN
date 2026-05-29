#!/usr/bin/env bash
# Re-runs the migration on any non-zero exit, up to MAX attempts.
# Migration is idempotent so resuming is safe. Stops cleanly when
# the migration emits its "Report:" summary line.
set -u
MAX="${MAX_ATTEMPTS:-12}"
LOG="${LOG_FILE:-/tmp/migrate.log}"
attempt=0
while [ "$attempt" -lt "$MAX" ]; do
  attempt=$((attempt + 1))
  echo "── supervisor: attempt $attempt/$MAX at $(date -u +%H:%M:%S) ──" >> "$LOG"
  npm run migrate:shopify >> "$LOG" 2>&1
  status=$?
  if grep -q "^Report:" "$LOG"; then
    echo "── supervisor: migration produced a Report line; done. ──" >> "$LOG"
    exit 0
  fi
  if [ "$status" -eq 0 ]; then
    echo "── supervisor: process exited cleanly without Report — odd; stopping. ──" >> "$LOG"
    exit 0
  fi
  delay=$((30 * attempt))
  echo "── supervisor: exit=$status, sleeping ${delay}s then retrying ──" >> "$LOG"
  sleep "$delay"
done
echo "── supervisor: gave up after $MAX attempts ──" >> "$LOG"
exit 1
