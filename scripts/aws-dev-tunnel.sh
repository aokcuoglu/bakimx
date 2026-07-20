#!/usr/bin/env bash
# Open an SSM port-forward tunnel from localhost:5433 to the AWS dev RDS.
#
# Day-to-day local development connects to the AWS dev database, not a local one.
# `.env.local` (DATABASE_URL / DIRECT_URL) points at localhost:5433, which this
# tunnel forwards to the private RDS instance `bakimx-dev-db`.
#
# Usage:  bun run db:tunnel          (keep it running in its own terminal)
# The ECS task/runtime IDs change on every deploy, so they are resolved fresh here.
# Re-run if the session drops (SSM idle-timeouts after a period of inactivity).
set -euo pipefail

ENV="${ENV:-dev}"
PROFILE="${AWS_PROFILE:-bakimx-$ENV}"
REGION="${AWS_REGION:-eu-central-1}"
LOCAL_PORT="${LOCAL_PORT:-5433}"
CLUSTER="bakimx-$ENV-cluster"
SERVICE="bakimx-$ENV-app-svc"

if lsof -nP -iTCP:"$LOCAL_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "✗ localhost:$LOCAL_PORT is already in use — tunnel already open?" >&2
  exit 1
fi

echo "→ Resolving RUNNING ECS task for $SERVICE ..."
TASK_ARN=$(aws ecs list-tasks --cluster "$CLUSTER" --service-name "$SERVICE" \
  --desired-status RUNNING --profile "$PROFILE" --region "$REGION" \
  --query 'taskArns[0]' --output text)
if [ "$TASK_ARN" = "None" ] || [ -z "$TASK_ARN" ]; then
  echo "✗ No RUNNING task found for $SERVICE (is the dev service up?)" >&2
  exit 1
fi
TASK_ID=$(basename "$TASK_ARN")
RUNTIME_ID=$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ARN" \
  --profile "$PROFILE" --region "$REGION" \
  --query 'tasks[0].containers[0].runtimeId' --output text)
RDS_HOST=$(aws rds describe-db-instances --db-instance-identifier "bakimx-$ENV-db" \
  --profile "$PROFILE" --region "$REGION" \
  --query 'DBInstances[0].Endpoint.Address' --output text)

echo "  Task:   $TASK_ID"
echo "  RDS:    $RDS_HOST"
echo "  Tunnel: localhost:$LOCAL_PORT → $RDS_HOST:5432"
echo "  (Ctrl-C to close. Keep this open while developing.)"
echo

exec aws ssm start-session \
  --target "ecs:${CLUSTER}_${TASK_ID}_${RUNTIME_ID}" \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "{\"host\":[\"$RDS_HOST\"],\"portNumber\":[\"5432\"],\"localPortNumber\":[\"$LOCAL_PORT\"]}" \
  --profile "$PROFILE" --region "$REGION"
