#!/usr/bin/env bash
# Shared liveness helpers for the AWS dev DB tunnel (localhost:5433).
#
# WHY THIS EXISTS: a dead SSM port-forward is invisible to `lsof`. When the
# Session Manager session is reaped, `session-manager-plugin` keeps the local
# socket bound and still ACCEPTS connections — the port shows LISTEN while not a
# single byte flows. Every "is the tunnel up?" check must therefore be
# end-to-end, never a port check. A stale tunnel surfaces as Prisma
# "Connection terminated due to connection timeout" and reads like an app bug.
#
# Source it, don't run it:  . "$ROOT/scripts/tunnel-health.sh"

# tunnel_alive <port> [timeout_secs]
#   0 = the far side answered the Postgres SSLRequest → data really flows
#   1 = nothing listening, or listening but mute (stale tunnel)
tunnel_alive() {
  local port="${1:-5433}" timeout="${2:-5}"
  (
    # Postgres SSLRequest: 8 bytes, answered with a single byte ('S'/'N'/'E').
    # bash's /dev/tcp keeps this dependency-free (no psql/nc needed) and the
    # bounded `read -t` is the whole point — a plain read hangs forever here.
    exec 3<>"/dev/tcp/127.0.0.1/$port" || exit 1
    printf '\x00\x00\x00\x08\x04\xd2\x16\x2f' >&3 || exit 1
    local reply=""
    IFS= read -r -n 1 -t "$timeout" reply <&3 || exit 1
    [ -n "$reply" ] || exit 1
  ) 2>/dev/null
}

# tunnel_listener_pids <port> — pids holding the port in LISTEN.
tunnel_listener_pids() {
  lsof -nP -iTCP:"${1:-5433}" -sTCP:LISTEN -t 2>/dev/null || true
}

# recycle_stale_tunnel <port>
# Tears down a listener that belongs to a dead tunnel so a fresh session can
# bind. Only ever kills SSM tunnel processes; anything else is reported and left
# alone (the port could legitimately belong to another service).
#   0 = port is free now
#   1 = could not free it
recycle_stale_tunnel() {
  local port="${1:-5433}" pids pid cmd killed=0 _i
  pids="$(tunnel_listener_pids "$port")"
  [ -n "$pids" ] || return 0

  for pid in $pids; do
    cmd="$(ps -o command= -p "$pid" 2>/dev/null || true)"
    case "$cmd" in
      *session-manager-plugin*|*"ssm start-session"*)
        echo "  Killing stale tunnel process $pid ..." >&2
        pkill -P "$pid" 2>/dev/null || true
        kill "$pid" 2>/dev/null || true
        killed=1
        ;;
      *)
        echo "✗ localhost:$port is held by an unrelated process (pid $pid):" >&2
        echo "    $cmd" >&2
        return 1
        ;;
    esac
  done
  [ "$killed" = 1 ] || return 1

  for _i in 1 2 3 4 5 6 7 8 9 10; do
    [ -z "$(tunnel_listener_pids "$port")" ] && return 0
    sleep 1
  done
  for pid in $(tunnel_listener_pids "$port"); do kill -9 "$pid" 2>/dev/null || true; done
  sleep 1
  [ -z "$(tunnel_listener_pids "$port")" ]
}

# sweep_orphan_tunnel <port> — teardown belt-and-braces.
# Killing `aws ssm start-session` does NOT take session-manager-plugin with it:
# the plugin is reparented to init, where `pkill -P` can no longer find it, and
# it keeps the port bound and mute. Anything still answering on the port is a
# healthy tunnel (a sibling supervisor's) and is left strictly alone.
sweep_orphan_tunnel() {
  local port="${1:-5433}"
  [ -n "$(tunnel_listener_pids "$port")" ] || return 0
  tunnel_alive "$port" 2 && return 0
  recycle_stale_tunnel "$port" >/dev/null 2>&1 || true
  return 0
}
