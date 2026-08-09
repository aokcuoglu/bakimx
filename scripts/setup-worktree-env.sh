#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Kullanım: $0 <worktree-path>" >&2
  exit 64
fi

repo_root="$(git rev-parse --show-toplevel)"
target_root="$(cd "$1" && pwd -P)"
primary_root="$(git -C "$repo_root" worktree list --porcelain | awk '/^worktree / { sub(/^worktree /, ""); print; exit }')"
source_env="$primary_root/.env.local"
target_env="$target_root/.env.local"

if ! git -C "$repo_root" worktree list --porcelain | awk '/^worktree / { sub(/^worktree /, ""); print }' | grep -Fxq "$target_root"; then
  echo "Hata: hedef kayıtlı bir git worktree değil: $target_root" >&2
  exit 65
fi

if [[ "$target_root" == "$primary_root" ]]; then
  echo "Hata: birincil checkout worktree hedefi olarak kullanılamaz." >&2
  exit 65
fi

if [[ ! -f "$source_env" ]]; then
  echo "Hata: birincil checkout'ta .env.local bulunamadı: $source_env" >&2
  exit 66
fi

if [[ -e "$target_env" || -L "$target_env" ]]; then
  if [[ -L "$target_env" && "$(readlink "$target_env")" == "$source_env" ]]; then
    echo "Hazır: $target_env zaten birincil .env.local dosyasına bağlı."
    exit 0
  fi

  echo "Hata: hedefte mevcut .env.local var; üzerine yazılmadı: $target_env" >&2
  exit 73
fi

ln -s "$source_env" "$target_env"
echo "Hazır: $target_env -> $source_env"
