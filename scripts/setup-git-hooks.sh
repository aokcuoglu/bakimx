#!/usr/bin/env bash
set -uo pipefail

# ──────────────────────────────────────────────────────────────────────────
# Versiyonlanmış hook dizinini (.githooks) repoya bağlar.
#
# package.json'ın `postinstall`undan çalışır → Docker build ve CI'da .git
# yoktur, orada sessizce çıkar. Hiçbir koşulda kurulumu bozmamalı.
# core.hooksPath .git/config'e yazılır; bu tüm worktree'ler tarafından
# paylaşıldığı için tek seferlik kurulum hepsini kapsar.
# ──────────────────────────────────────────────────────────────────────────

git rev-parse --git-dir >/dev/null 2>&1 || exit 0
[ -d .githooks ] || exit 0

chmod +x .githooks/post-merge .githooks/post-checkout .githooks/lib/*.sh 2>/dev/null || true

CURRENT="$(git config --get core.hooksPath 2>/dev/null || true)"
if [ "$CURRENT" != ".githooks" ]; then
  if git config core.hooksPath .githooks 2>/dev/null; then
    echo "✅ Git hook'ları kuruldu (core.hooksPath=.githooks)"
  fi
fi

exit 0
