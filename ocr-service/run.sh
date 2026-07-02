#!/usr/bin/env bash
# BakımX ruhsat OCR sidecar'ını başlatır (dev).
# İlk kez: python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -x ".venv/bin/uvicorn" ]; then
  echo "HATA: .venv bulunamadı. Önce kurulum:" >&2
  echo "  python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt" >&2
  exit 1
fi

PORT="${OCR_SERVICE_PORT:-8000}"
export PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True
exec .venv/bin/uvicorn main:app --host 127.0.0.1 --port "$PORT" --log-level warning
