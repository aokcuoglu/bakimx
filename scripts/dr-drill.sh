#!/usr/bin/env bash
# Yedekten geri dönüş tatbikatı — prod snapshot'ından GEÇİCİ bir instance ayağa
# kaldırır, kullanılabilirliğini doğrular ve siler.
#
# NEDEN: 2026-08-19'a kadar RDS snapshot'ı alınıyordu ama hiç geri dönülmemişti
# (BAK-120). Denenmemiş yedek yedek değildir; bu script tatbikatı bir insanın
# hatırlamasına bağlı olmaktan çıkarır ve her koşuda RTO'yu ölçer.
#
# KAYNAK VERİTABANINA DOKUNMAZ. Tek yazma işlemi, kendi yarattığı geçici
# instance'ı silmektir; kaynak instance yalnız `describe` ile okunur ve
# snapshot'lar salt-okunur kullanılır.
#
# Kullanım (proje kökünden):
#   bash scripts/dr-drill.sh                 # tam tur: restore → doğrula → sil
#   bash scripts/dr-drill.sh --keep          # silme (elle inceleyeceksen)
#   ENV=dev bash scripts/dr-drill.sh         # dev hesabında prova
#   bash scripts/dr-drill.sh teardown <id>   # yarıda kalmış bir tatbikatı temizle
#
# Prosedürün tamamı ve sonuç kaydı: docs/operations/disaster-recovery.md
set -euo pipefail

ENV="${ENV:-prod}"
PROFILE="${AWS_PROFILE:-bakimx-$ENV}"
REGION="${AWS_REGION:-eu-central-1}"
SRC_DB="bakimx-$ENV-db"
CLUSTER="bakimx-$ENV-cluster"
SERVICE="bakimx-$ENV-app-svc"
# Günlük tünel 5433'ü (dev) ve 5434/5435'i (prod/dev teşhis) kullanıyor; tatbikat
# ayrı bir port alır ki açık bir geliştirme tüneli kapanmasın.
LOCAL_PORT="${DR_LOCAL_PORT:-5436}"
STAMP="$(date -u +%Y%m%d-%H%M)"

aws_() { aws "$@" --profile "$PROFILE" --region "$REGION"; }
say() { echo "→ $*" >&2; }
die() { echo "✗ $*" >&2; exit 1; }

# ── teardown ──────────────────────────────────────────────────────────────────
# Ayrı bir fonksiyon çünkü hem normal akışın sonunda hem de hata/trap yolunda
# çağrılır: yarım kalan bir tatbikat saatlik ücret yazan bir instance bırakır.
teardown() {
  local id="$1"
  say "Geçici instance siliniyor: $id"
  aws_ rds delete-db-instance --db-instance-identifier "$id" \
    --skip-final-snapshot --delete-automated-backups \
    --query 'DBInstance.DBInstanceStatus' --output text >/dev/null
  say "Silme başlatıldı (arka planda birkaç dakika sürer)."
}

if [ "${1:-}" = "teardown" ]; then
  [ -n "${2:-}" ] || die "kullanım: bash scripts/dr-drill.sh teardown <instance-id>"
  case "$2" in bakimx-dr-drill-*) ;; *) die "Yalnız bakimx-dr-drill-* silinebilir: $2" ;; esac
  teardown "$2"
  exit 0
fi

KEEP=0
[ "${1:-}" = "--keep" ] && KEEP=1

command -v aws >/dev/null || die "aws CLI gerekli"
command -v session-manager-plugin >/dev/null || die "session-manager-plugin gerekli"

# ── 1. Kaynak: en yeni OTOMATİK snapshot ──────────────────────────────────────
# Bilerek otomatik snapshot: tatbikatın amacı elle alınmış özel bir yedeği değil,
# gerçek bir olayda elimizde olacak GÜNLÜK yedeği denemek.
SNAPSHOT="$(aws_ rds describe-db-snapshots --db-instance-identifier "$SRC_DB" \
  --snapshot-type automated --query 'sort_by(DBSnapshots,&SnapshotCreateTime)[-1].DBSnapshotIdentifier' \
  --output text)"
[ -n "$SNAPSHOT" ] && [ "$SNAPSHOT" != "None" ] || die "$SRC_DB için otomatik snapshot bulunamadı"
SNAPSHOT_TIME="$(aws_ rds describe-db-snapshots --db-snapshot-identifier "$SNAPSHOT" \
  --query 'DBSnapshots[0].SnapshotCreateTime' --output text)"

# Ağ ve sınıf kaynağın aynısı olmalı: farklı bir subnet grubu ya da SG ile yapılan
# tatbikat gerçek olayı temsil etmez (uygulama o yoldan bağlanacak).
read -r CLASS SNG SG PG <<EOF
$(aws_ rds describe-db-instances --db-instance-identifier "$SRC_DB" \
  --query 'DBInstances[0].[DBInstanceClass,DBSubnetGroup.DBSubnetGroupName,VpcSecurityGroups[0].VpcSecurityGroupId,DBParameterGroups[0].DBParameterGroupName]' \
  --output text)
EOF

TARGET="bakimx-dr-drill-${STAMP}"
say "Kaynak snapshot: $SNAPSHOT ($SNAPSHOT_TIME)"
say "Hedef instance:  $TARGET ($CLASS, $SNG, $SG)"

START_EPOCH="$(date +%s)"
aws_ rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier "$TARGET" \
  --db-snapshot-identifier "$SNAPSHOT" \
  --db-instance-class "$CLASS" \
  --db-subnet-group-name "$SNG" \
  --vpc-security-group-ids "$SG" \
  --db-parameter-group-name "$PG" \
  --no-publicly-accessible --no-multi-az --no-deletion-protection \
  --tags Key=purpose,Value=dr-drill Key=issue,Value=BAK-120 Key=ephemeral,Value=true \
  --query 'DBInstance.DBInstanceStatus' --output text >/dev/null

# Bu noktadan sonra her çıkış yolu instance'ı silmeli.
cleanup() {
  local code=$?
  [ -n "${TUNNEL_PID:-}" ] && { pkill -P "$TUNNEL_PID" 2>/dev/null || true; kill "$TUNNEL_PID" 2>/dev/null || true; }
  rm -f "${URL_FILE:-/dev/null}" 2>/dev/null || true
  if [ "$KEEP" = "1" ]; then
    echo "→ --keep verildi: $TARGET AYAKTA BIRAKILDI. Bitince: bash scripts/dr-drill.sh teardown $TARGET" >&2
  else
    teardown "$TARGET" || echo "✗ $TARGET SİLİNEMEDİ — elle silin!" >&2
  fi
  exit "$code"
}
trap cleanup EXIT INT TERM

say "Geri yükleme bekleniyor (tipik 10–20 dk) ..."
# `wait` varsayılanı 60×30 sn = 30 dk; büyük bir instance'ta yetmezse ikinci kez çağır.
aws_ rds wait db-instance-available --db-instance-identifier "$TARGET" \
  || aws_ rds wait db-instance-available --db-instance-identifier "$TARGET"
RESTORE_SECS=$(( $(date +%s) - START_EPOCH ))
say "Instance hazır — $((RESTORE_SECS / 60)) dk $((RESTORE_SECS % 60)) sn (RTO'nun veritabanı bileşeni)"

HOST="$(aws_ rds describe-db-instances --db-instance-identifier "$TARGET" \
  --query 'DBInstances[0].Endpoint.Address' --output text)"

# ── 2. Tünel: uygulamanın kendi ağ yolundan ───────────────────────────────────
# Instance private subnet'te ve SG yalnız Fargate'ten 5432 kabul ediyor; bu yüzden
# doğrulama da çalışan ECS görevinin üstünden SSM port-forward ile yapılır. Aynı
# yol gerçek bir kurtarmada da kullanılacak yoldur.
TASK_ARN="$(aws_ ecs list-tasks --cluster "$CLUSTER" --service-name "$SERVICE" \
  --desired-status RUNNING --query 'taskArns[0]' --output text)"
[ "$TASK_ARN" != "None" ] || die "$SERVICE için RUNNING görev yok — tünel açılamaz"
RUNTIME_ID="$(aws_ ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ARN" \
  --query 'tasks[0].containers[0].runtimeId' --output text)"

say "Tünel: localhost:$LOCAL_PORT → $HOST:5432"
aws_ ssm start-session --target "ecs:${CLUSTER}_$(basename "$TASK_ARN")_${RUNTIME_ID}" \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "{\"host\":[\"$HOST\"],\"portNumber\":[\"5432\"],\"localPortNumber\":[\"$LOCAL_PORT\"]}" \
  >/dev/null 2>&1 &
TUNNEL_PID=$!

for _ in $(seq 1 30); do
  nc -z localhost "$LOCAL_PORT" 2>/dev/null && break
  sleep 1
done
nc -z localhost "$LOCAL_PORT" 2>/dev/null || die "Tünel açılamadı (localhost:$LOCAL_PORT)"

# ── 3. Doğrulama ──────────────────────────────────────────────────────────────
# Parola dosyadan geçer (process listesine düşmesin) ve host tünele çevrilir.
URL_FILE="$(mktemp -t bakimx-dr-url)"
chmod 600 "$URL_FILE"
aws_ secretsmanager get-secret-value --secret-id "bakimx/$ENV/db-url" \
  --query SecretString --output text \
  | sed -E "s#@[^/]+/#@localhost:${LOCAL_PORT}/#" > "$URL_FILE"

# `set -e` altında doğrudan çağrı, doğrulama kırmızıya düştüğünde özeti bastırmadan
# script'i öldürürdü — oysa BAŞARISIZ bir tatbikatın raporu en çok lazım olanıdır.
VERIFY_CODE=0
DR_DB_URL_FILE="$URL_FILE" DB_SSL_NO_VERIFY=true bunx tsx scripts/dr-verify.ts || VERIFY_CODE=$?

echo
echo "── Tatbikat özeti ──"
echo "  Ortam:            $ENV"
echo "  Snapshot:         $SNAPSHOT ($SNAPSHOT_TIME)"
echo "  Geçici instance:  $TARGET ($CLASS)"
echo "  Geri yükleme:     $((RESTORE_SECS / 60)) dk $((RESTORE_SECS % 60)) sn"
echo "  Doğrulama:        $([ "$VERIFY_CODE" = "0" ] && echo BAŞARILI || echo BAŞARISIZ)"
echo
echo "Sonucu docs/operations/disaster-recovery.md §5 tablosuna işleyin."

exit "$VERIFY_CODE"
