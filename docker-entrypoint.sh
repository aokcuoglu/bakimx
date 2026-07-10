#!/bin/sh
set -e

# Deploy sonrası "bayat chunk" kurtarması (Katman 2).
#
# Next standalone, /_next/static'i konteynerin diskinden servis eder. Her build
# içerik-hash'li chunk dosyaları üretir; içeriği değişen chunk yeni bir isim alır.
# Bu asset'leri KALICI bir volume'da (compose: next-static → /app/.next/static)
# biriktirirsek, eski deploy'ların chunk'ları diskte kalır. Böylece cache'li eski
# HTML tutan bir istemci eski chunk'ı istediğinde 404 yerine 200 alır — sayfa
# yenilemeye (Katman 1) bile gerek kalmadan çalışmaya devam eder.
#
# Sadece Next server başlarken çalışır; aynı imajı kendi command'ıyla kullanan
# tek-seferlik `migrate` job'ında atlanır.
if [ "${1:-}" = "node" ] && [ "${2:-}" = "server.js" ]; then
  mkdir -p /app/.next/static
  # -u: bu build'in dosyalarını tazele (mtime yenilensin) + eksikleri ekle; volume'daki
  # eski (artık hiçbir canlı build'de olmayan) chunk'lara dokunma → aşağıda yaşlanıp silinir.
  cp -ru /app/static-dist/. /app/.next/static/ 2>/dev/null || true
  # Grace penceresi: 14 gündür dokunulmamış asset'leri temizle ki volume sınırsız büyümesin.
  # Aktif chunk'lar her deploy'da cp -u ile tazelendiği için bu sınırın altında kalır.
  find /app/.next/static -type f -mtime +14 -delete 2>/dev/null || true
fi

exec "$@"
