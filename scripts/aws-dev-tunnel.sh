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
set -euo pipefail

ENV="${ENV:-dev}"
PROFILE="${AWS_PROFILE:-bakimx-$ENV}"
REGION="${AWS_REGION:-eu-central-1}"
LOCAL_PORT="${LOCAL_PORT:-5433}"
CLUSTER="bakimx-$ENV-cluster"
SERVICE="bakimx-$ENV-app-svc"
# Comfortably inside the 20 min idle timeout, and cheap (one TCP round-trip).
KEEPALIVE_SECS="${KEEPALIVE_SECS:-300}"
RETRY_SECS="${RETRY_SECS:-5}"
# session-manager-plugin her gelen TCP bağlantısı için bir
# "Connection accepted for session [...]" satırı basar. Prisma'nın havuzu
# (ve aşağıdaki keepalive) sürekli bağlantı açtığı için filtresiz tünel,
# çalıştığı terminali — ve üstüne çizilen TUI'yi — doldurur. Tüneli teşhis
# ederken ham çıktı için TUNNEL_VERBOSE=1.
VERBOSE="${TUNNEL_VERBOSE:-0}"

if lsof -nP -iTCP:"$LOCAL_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "✗ localhost:$LOCAL_PORT is already in use — tunnel already open?" >&2
  exit 1
fi

KEEPALIVE_PID=""
SESSION_PID=""
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
  echo
  echo "→ Tunnel closed."
  exit "${1:-0}"
}
trap cleanup INT TERM

# Postgres SSLRequest packet: 8 bytes, to which the server answers 'S' or 'N'.
# Sending it through the tunnel counts as session activity and resets the idle
# timer. bash's /dev/tcp keeps this dependency-free (no psql/nc needed).
keepalive_loop() {
  while true; do
    sleep "$KEEPALIVE_SECS"
    (
      exec 3<>"/dev/tcp/127.0.0.1/$LOCAL_PORT" || exit 0
      printf '\x00\x00\x00\x08\x04\xd2\x16\x2f' >&3
      head -c 1 <&3 >/dev/null
      exec 3<&-
    ) 2>/dev/null || true
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

keepalive_loop &
KEEPALIVE_PID=$!

echo "  (Ctrl-C to close. Keep this open while developing.)"
echo "  Auto-reconnects if the session drops; keepalive every ${KEEPALIVE_SECS}s."
echo

# `set -e` must not kill the supervisor when a session ends or a resolve fails.
while true; do
  # Bu tünel yeniden bağlanmaya çalışırken başka bir tünel portu kapmış
  # olabilir; yukarıdaki açılış kontrolü yalnız ilk denemeyi kapsıyor. Bu
  # olmadan kaybeden taraf, asla bağlanamayacağı hâlde sonsuza dek döner.
  if lsof -nP -iTCP:"$LOCAL_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "✗ localhost:$LOCAL_PORT is now held by another process — another tunnel is open. Exiting." >&2
    cleanup 1
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
  wait "$SESSION_PID" 2>/dev/null || true
  SESSION_PID=""

  echo "→ Session ended — reconnecting in ${RETRY_SECS}s (Ctrl-C to stop) ..." >&2
  sleep "$RETRY_SECS"
done
