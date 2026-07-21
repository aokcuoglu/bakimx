#!/usr/bin/env bash
# Start the AWS dev DB tunnel + Next dev server together.
#
# Day-to-day local development connects to the AWS dev database via an SSM
# port-forward on localhost:5433 (see scripts/aws-dev-tunnel.sh). This wrapper
# opens that tunnel in the background, waits until it is listening, then runs
# `next dev`. When you Ctrl-C the dev server, the tunnel is torn down too.
set -euo pipefail

LOCAL_PORT="${LOCAL_PORT:-5433}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

TUNNEL_PID=""
cleanup() {
  if [ -n "$TUNNEL_PID" ] && kill -0 "$TUNNEL_PID" 2>/dev/null; then
    echo "→ Closing DB tunnel (pid $TUNNEL_PID) ..."
    kill "$TUNNEL_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if lsof -nP -iTCP:"$LOCAL_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "✓ Tunnel already listening on localhost:$LOCAL_PORT — reusing it."
else
  echo "→ Opening DB tunnel ..."
  bash "$ROOT/scripts/aws-dev-tunnel.sh" &
  TUNNEL_PID=$!

  echo "→ Waiting for localhost:$LOCAL_PORT ..."
  for _ in $(seq 1 60); do
    if lsof -nP -iTCP:"$LOCAL_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
      break
    fi
    if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
      echo "✗ Tunnel process exited before it started listening." >&2
      exit 1
    fi
    sleep 1
  done
  if ! lsof -nP -iTCP:"$LOCAL_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "✗ Tunnel did not come up on localhost:$LOCAL_PORT within 60s." >&2
    exit 1
  fi
  echo "✓ Tunnel up."
fi

echo "→ Starting next dev ..."
cd "$ROOT"
exec next dev
