#!/usr/bin/env bash
# Open an SSM port-forward tunnel from localhost:5433 to the AWS dev RDS.
#
# Day-to-day local development connects to the AWS dev database, not a local one.
# `.env.local` (DATABASE_URL / DIRECT_URL) points at localhost:5433, which this
# tunnel forwards to the private RDS instance `bakimx-dev-db`.
#
# Usage:  bun run db:tunnel          (keep it running in its own terminal)
#
# SELF-HEALING (2026-07-27): the session used to be `exec`'d once, so any drop
# left port 5433 dead until someone noticed — and a dead tunnel surfaces as HTTP
# 500s / Prisma `ECONNREFUSED`, which reads like an application bug and burns
# time. Sessions drop for three routine reasons:
#   1. Session Manager's idle timeout (AWS default 20 min; this account defines
#      no custom SSM-SessionManagerRunShell document, so the default applies) —
#      an idle Prisma pool sends nothing, so the session is reaped.
#   2. A dev deploy replaces the ECS task the session is attached to.
#   3. Laptop sleep / network blips.
# A keepalive prevents (1); a supervisor loop that re-resolves the task recovers
# from all three within seconds.
#
# SELF-HEALING, PART 2 (2026-08-09): the supervisor above still could not
# recover from the most common failure, because a reaped session does NOT end
# the local process — `session-manager-plugin` keeps the socket bound and mute,
# so `aws ssm start-session` never returns, `wait` never returns, and the
# supervisor sits there forever while every query dies with
# "Connection terminated due to connection timeout". The old keepalive could not
# notice either: its unbounded `head -c 1` hung on the same dead socket, killing
# the keepalive loop permanently on the first drop. The keepalive is now a
# *bounded* health probe that recycles the session when the tunnel goes mute.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/tunnel-health.sh
. "$ROOT/scripts/tunnel-health.sh"

ENV="${ENV:-dev}"
PROFILE="${AWS_PROFILE:-bakimx-$ENV}"
REGION="${AWS_REGION:-eu-central-1}"
LOCAL_PORT="${LOCAL_PORT:-5433}"
CLUSTER="bakimx-$ENV-cluster"
SERVICE="bakimx-$ENV-app-svc"
# Health probe interval. Doubles as the keepalive (the probe is real traffic, so
# it resets the 20 min idle timer) — hence comfortably inside it, and cheap
# enough at one TCP round-trip to also give fast detection of a mute tunnel.
# KEEPALIVE_SECS is still honoured for muscle memory.
PROBE_SECS="${PROBE_SECS:-${KEEPALIVE_SECS:-60}}"
# How long the far side may stay silent before a probe counts as a miss.
PROBE_TIMEOUT="${PROBE_TIMEOUT:-5}"
# Grace given to a freshly started session before it is probed at all.
GRACE_SECS="${GRACE_SECS:-30}"
RETRY_SECS="${RETRY_SECS:-5}"
# session-manager-plugin her gelen TCP bağlantısı için bir
# "Connection accepted for session [...]" satırı basar. Prisma'nın havuzu
# (ve aşağıdaki keepalive) sürekli bağlantı açtığı için filtresiz tünel,
# çalıştığı terminali — ve üstüne çizilen TUI'yi — doldurur. Tüneli teşhis
# ederken ham çıktı için TUNNEL_VERBOSE=1.
VERBOSE="${TUNNEL_VERBOSE:-0}"

if [ -n "$(tunnel_listener_pids "$LOCAL_PORT")" ]; then
  if tunnel_alive "$LOCAL_PORT" "$PROBE_TIMEOUT"; then
    echo "✗ localhost:$LOCAL_PORT is already in use by a HEALTHY tunnel — one is already open." >&2
    exit 1
  fi
  echo "→ localhost:$LOCAL_PORT is held by a dead tunnel (accepts, never answers) — recycling it ..." >&2
  if ! recycle_stale_tunnel "$LOCAL_PORT"; then
    echo "✗ Could not free localhost:$LOCAL_PORT." >&2
    exit 1
  fi
fi

KEEPALIVE_PID=""
SESSION_PID=""
# The health probe runs in a background subshell, which therefore only ever sees
# the SESSION_PID it was forked with (empty). The file is how it learns which
# session to recycle.
SESSION_PID_FILE="$(mktemp -t bakimx-tunnel)"
cleanup() {
  trap - INT TERM
  [ -n "$KEEPALIVE_PID" ] && kill "$KEEPALIVE_PID" 2>/dev/null || true
  # Oturumu da açıkça indir. Gerçek Ctrl-C'de terminal SIGINT'i tüm süreç
  # grubuna dağıttığı için bu gereksiz görünür; ama script'e doğrudan sinyal
  # gönderildiğinde (kill, IDE'nin "stop"u, dev:tunnel sarmalayıcısı) aws ve
  # onun session-manager-plugin çocuğu hayatta kalıp portu tutuyordu — sonuç
  # TCP'yi kabul eden ama Postgres el sıkışması yapmayan BAYAT bir tünel ve
  # teşhisi zor bir P1001.
  if [ -n "$SESSION_PID" ]; then
    pkill -P "$SESSION_PID" 2>/dev/null || true
    kill "$SESSION_PID" 2>/dev/null || true
  fi
  # Even in the right order the plugin can outlive its parent (already
  # reparented, or killed from outside). Leave nothing mute on the port.
  sweep_orphan_tunnel "$LOCAL_PORT"
  rm -f "$SESSION_PID_FILE" 2>/dev/null || true
  echo
  echo "→ Tunnel closed."
  exit "${1:-0}"
}
trap cleanup INT TERM

# Bounded end-to-end probe (see scripts/tunnel-health.sh). It doubles as the
# keepalive — the SSLRequest is real traffic, so it resets the idle timer — and
# as the drop detector. When the far side goes mute the local session process is
# still alive holding the port, so `wait` below would never return; killing it
# here is what lets the supervisor loop reconnect.
health_loop() {
  local pid started now fails=0
  while true; do
    sleep "$PROBE_SECS"

    # "<pid> <epoch>" — empty while the supervisor is between sessions.
    read -r pid started < "$SESSION_PID_FILE" 2>/dev/null || true
    if [ -z "${pid:-}" ] || [ -z "${started:-}" ]; then fails=0; continue; fi

    # A session takes a few seconds to bind and register the port forward.
    # Probing inside that window judges a healthy session as dead and kills it,
    # which is how a single drop turned into a minutes-long reconnect storm.
    now="$(date +%s)"
    if [ "$((now - started))" -lt "$GRACE_SECS" ]; then fails=0; continue; fi
    if [ -z "$(tunnel_listener_pids "$LOCAL_PORT")" ]; then fails=0; continue; fi

    if tunnel_alive "$LOCAL_PORT" "$PROBE_TIMEOUT"; then fails=0; continue; fi

    # One miss can be a slow round-trip; two in a row is a dead tunnel.
    fails=$((fails + 1))
    [ "$fails" -ge 2 ] || continue
    fails=0

    echo "✗ Tunnel stopped answering — recycling the session ..." >&2
    pkill -P "$pid" 2>/dev/null || true
    kill "$pid" 2>/dev/null || true
  done
}

# Echoes "<ssm-target> <rds-host>" on success. Task/runtime IDs change on every
# deploy, so this runs fresh on every (re)connect — a stale id is exactly what
# would break reconnects after a deploy.
resolve_target() {
  local task_arn task_id runtime_id rds_host
  task_arn=$(aws ecs list-tasks --cluster "$CLUSTER" --service-name "$SERVICE" \
    --desired-status RUNNING --profile "$PROFILE" --region "$REGION" \
    --query 'taskArns[0]' --output text) || return 1
  if [ "$task_arn" = "None" ] || [ -z "$task_arn" ]; then
    echo "✗ No RUNNING task found for $SERVICE (is the dev service up?)" >&2
    return 1
  fi
  task_id=$(basename "$task_arn")
  runtime_id=$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$task_arn" \
    --profile "$PROFILE" --region "$REGION" \
    --query 'tasks[0].containers[0].runtimeId' --output text) || return 1
  rds_host=$(aws rds describe-db-instances --db-instance-identifier "bakimx-$ENV-db" \
    --profile "$PROFILE" --region "$REGION" \
    --query 'DBInstances[0].Endpoint.Address' --output text) || return 1
  echo "ecs:${CLUSTER}_${task_id}_${runtime_id} $rds_host"
}

health_loop &
KEEPALIVE_PID=$!

echo "  (Ctrl-C to close. Keep this open while developing.)"
echo "  Auto-reconnects if the session drops or goes mute; health probe every ${PROBE_SECS}s."
echo

# `set -e` must not kill the supervisor when a session ends or a resolve fails.
while true; do
  # Bu tünel yeniden bağlanmaya çalışırken başka bir tünel portu kapmış
  # olabilir; yukarıdaki açılış kontrolü yalnız ilk denemeyi kapsıyor. Bu
  # olmadan kaybeden taraf, asla bağlanamayacağı hâlde sonsuza dek döner.
  if [ -n "$(tunnel_listener_pids "$LOCAL_PORT")" ]; then
    if tunnel_alive "$LOCAL_PORT" "$PROBE_TIMEOUT"; then
      echo "✗ localhost:$LOCAL_PORT is now held by a healthy tunnel — another one is open. Exiting." >&2
      cleanup 1
    fi
    # Our own just-recycled session may still be releasing the socket, or a
    # sibling supervisor died mute. Either way nothing can bind until it goes.
    echo "→ Clearing the dead listener on localhost:$LOCAL_PORT ..." >&2
    if ! recycle_stale_tunnel "$LOCAL_PORT"; then
      echo "✗ Could not free localhost:$LOCAL_PORT. Exiting." >&2
      cleanup 1
    fi
  fi

  echo "→ Resolving RUNNING ECS task for $SERVICE ..."
  if ! target_line=$(resolve_target); then
    # Resolve failed → this is a setup problem (expired SSO, dev service down),
    # not a dropped session. Back off harder so a broken state doesn't spin.
    echo "✗ Could not resolve target — AWS SSO expired (aws sso login --profile $PROFILE) or dev service down." >&2
    sleep "$((RETRY_SECS * 4))"
    continue
  fi
  read -r ssm_target rds_host <<<"$target_line"
  echo "  Target: $ssm_target"
  echo "  Tunnel: localhost:$LOCAL_PORT → $rds_host:5432"

  # Arka planda + `wait`: boru hattı kullanılsaydı `$!` grep'i verirdi ve
  # cleanup asıl aws sürecini bulamazdı. Process substitution ile filtre
  # uygulanırken `$!` gerçek oturum sürecini gösteriyor.
  if [ "$VERBOSE" = "1" ]; then
    aws ssm start-session \
      --target "$ssm_target" \
      --document-name AWS-StartPortForwardingSessionToRemoteHost \
      --parameters "{\"host\":[\"$rds_host\"],\"portNumber\":[\"5432\"],\"localPortNumber\":[\"$LOCAL_PORT\"]}" \
      --profile "$PROFILE" --region "$REGION" &
  else
    # stderr de filtreye giriyor ki gerçek hatalar (bind hatası, süresi dolmuş
    # SSO) görünmeye devam etsin; yalnız bağlantı-başına gürültü düşürülüyor.
    aws ssm start-session \
      --target "$ssm_target" \
      --document-name AWS-StartPortForwardingSessionToRemoteHost \
      --parameters "{\"host\":[\"$rds_host\"],\"portNumber\":[\"5432\"],\"localPortNumber\":[\"$LOCAL_PORT\"]}" \
      --profile "$PROFILE" --region "$REGION" \
      > >(grep --line-buffered -Ev '^Connection accepted for session') 2>&1 &
  fi
  SESSION_PID=$!
  echo "$SESSION_PID $(date +%s)" > "$SESSION_PID_FILE"
  wait "$SESSION_PID" 2>/dev/null || true
  SESSION_PID=""
  : > "$SESSION_PID_FILE"

  echo "→ Session ended — reconnecting in ${RETRY_SECS}s (Ctrl-C to stop) ..." >&2
  sleep "$RETRY_SECS"
done
