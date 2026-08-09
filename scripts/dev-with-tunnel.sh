#!/usr/bin/env bash
# Start the AWS dev DB tunnel + Next dev server together.
#
# Day-to-day local development connects to the AWS dev database via an SSM
# port-forward on localhost:5433 (see scripts/aws-dev-tunnel.sh). This wrapper
# opens that tunnel in the background, waits until it is listening, then runs
# `next dev`. When you Ctrl-C the dev server, the tunnel is torn down too.
#
# 2026-08-09: "already listening → reuse it" used to be a plain `lsof` check,
# which is not evidence of anything. A reaped SSM session leaves
# session-manager-plugin holding the port, accepting connections and answering
# nothing, so the wrapper cheerfully reused a dead tunnel and every page failed
# with Prisma "Connection terminated due to connection timeout". Reuse now
# requires an end-to-end probe; a mute listener is recycled instead.
set -euo pipefail

LOCAL_PORT="${LOCAL_PORT:-5433}"
PROBE_TIMEOUT="${PROBE_TIMEOUT:-5}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/tunnel-health.sh
. "$ROOT/scripts/tunnel-health.sh"

TUNNEL_PID=""
NEXT_PID=""
cleanup() {
  if [ -n "$NEXT_PID" ] && kill -0 "$NEXT_PID" 2>/dev/null; then
    kill "$NEXT_PID" 2>/dev/null || true
  fi
  if [ -n "$TUNNEL_PID" ] && kill -0 "$TUNNEL_PID" 2>/dev/null; then
    echo "→ Closing DB tunnel (pid $TUNNEL_PID) ..."
    # Signal the supervisor and let ITS trap do the ordered teardown. Killing
    # its children first (what this used to do) reaped `aws ssm start-session`
    # before the supervisor could act, which orphaned session-manager-plugin:
    # reparented to init, invisible to `pkill -P`, still holding port 5433 and
    # answering nothing. That orphan is the stale tunnel this script now has to
    # defend against — so teardown must not manufacture one.
    kill "$TUNNEL_PID" 2>/dev/null || true
    for _ in 1 2 3 4 5; do kill -0 "$TUNNEL_PID" 2>/dev/null || break; sleep 1; done
    pkill -P "$TUNNEL_PID" 2>/dev/null || true
    sweep_orphan_tunnel "$LOCAL_PORT"
  fi
}
trap cleanup EXIT INT TERM HUP

start_tunnel() {
  echo "→ Opening DB tunnel ..."
  bash "$ROOT/scripts/aws-dev-tunnel.sh" &
  TUNNEL_PID=$!

  echo "→ Waiting for localhost:$LOCAL_PORT ..."
  for _ in $(seq 1 60); do
    if tunnel_alive "$LOCAL_PORT" "$PROBE_TIMEOUT"; then
      echo "✓ Tunnel up."
      return 0
    fi
    if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
      echo "✗ Tunnel process exited before it started serving." >&2
      return 1
    fi
    sleep 1
  done
  echo "✗ Tunnel did not answer on localhost:$LOCAL_PORT within 60s." >&2
  return 1
}

if tunnel_alive "$LOCAL_PORT" "$PROBE_TIMEOUT"; then
  echo "✓ Tunnel on localhost:$LOCAL_PORT is alive (probed, not just listening) — reusing it."
elif [ -n "$(tunnel_listener_pids "$LOCAL_PORT")" ]; then
  echo "✗ localhost:$LOCAL_PORT is listening but DEAD (accepts, never answers) — stale tunnel." >&2
  if ! recycle_stale_tunnel "$LOCAL_PORT"; then
    echo "✗ Could not free localhost:$LOCAL_PORT — fix it before starting the dev server." >&2
    exit 1
  fi
  start_tunnel || exit 1
else
  start_tunnel || exit 1
fi

echo "→ Starting next dev ..."
cd "$ROOT"
# NOT `exec`: exec replaces this shell and takes the cleanup trap with it, so
# stopping the dev server left the tunnel supervisor running, orphaned. Those
# orphans pile up across days until one holds port 5433 with a dead session —
# the exact failure this script now has to detect.
# Backgrounded + `wait` rather than foreground: bash defers traps until a
# foreground child exits, so `kill`/IDE-stop would hang until next died. The
# child stays in this script's process group, so terminal Ctrl-C still reaches
# it directly.
next dev &
NEXT_PID=$!
wait "$NEXT_PID"
