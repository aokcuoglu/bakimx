#!/usr/bin/env bash
set -uo pipefail

# ──────────────────────────────────────────────────────────────────────────
# `prisma/` altında ne değiştiyse ona göre yerel kurulumu senkronize eder.
#
# Neden var: `prisma generate` yalnızca package.json'ın `postinstall`unda
# çalışıyor. Şema değiştiren bir dal çekildiğinde `bun install` tekrar
# çalışmazsa node_modules'daki Prisma Client bayat kalıyor ve hata KOD
# hatası gibi görünüyor (ör. "Unknown argument `deletedAt`") — oysa alan
# şemada var, sadece üretilmiş client onu tanımıyor.
#
# Kullanım (hook'lardan):  lib/prisma-sync.sh <eski-rev> <yeni-rev> <etiket>
# Asla install/checkout'u bozmaz: her yoldan 0 ile çıkar.
# ──────────────────────────────────────────────────────────────────────────

OLD_REV="${1:-}"
NEW_REV="${2:-}"
TRIGGER="${3:-git}"

[ -n "$OLD_REV" ] && [ -n "$NEW_REV" ] || exit 0
[ "$OLD_REV" != "$NEW_REV" ] || exit 0

# Hook'lar worktree kökünde çalışır; yine de garantiye alalım.
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || exit 0
cd "$ROOT" || exit 0

CHANGED="$(git diff --name-only "$OLD_REV" "$NEW_REV" -- prisma/ 2>/dev/null || true)"
[ -n "$CHANGED" ] || exit 0

if printf '%s\n' "$CHANGED" | grep -qx 'prisma/schema.prisma'; then
  PRISMA_BIN="$ROOT/node_modules/.bin/prisma"
  if [ -x "$PRISMA_BIN" ]; then
    echo "🔄 prisma/schema.prisma değişti ($TRIGGER) → Prisma Client yeniden üretiliyor..."
    if "$PRISMA_BIN" generate >/dev/null 2>&1; then
      echo "✅ Prisma Client güncel. (Çalışan dev sunucusunu yeniden başlat — Turbopack node_modules'ı hot-reload etmez.)"
    else
      echo "⚠️  prisma generate başarısız — elle 'bun run db:generate' çalıştır." >&2
    fi
  else
    echo "⚠️  prisma/schema.prisma değişti ama node_modules/.bin/prisma yok → 'bun install' çalıştır." >&2
  fi
fi

if printf '%s\n' "$CHANGED" | grep -q '^prisma/migrations/'; then
  echo "ℹ️  Yeni migration dosyası geldi → veritabanına uygulamak için (tünel açıkken) 'bun run db:deploy'."
fi

exit 0
