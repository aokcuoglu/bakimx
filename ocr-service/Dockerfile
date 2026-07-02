# BakımX ruhsat OCR sidecar imajı (PaddleOCR).
# KASITLI olarak Next.js Alpine imajından ayrıdır: paddlepaddle glibc wheel'leri
# ister (Alpine/musl çalışmaz) ve imaj ağırdır. Ayrı container olarak deploy edilir.
FROM python:3.11-slim

# paddlepaddle (libgomp) + opencv-python-headless (libglib/libgl) runtime bağımlılıkları,
# model indirmesi için ca-certificates.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libgomp1 \
      libglib2.0-0 \
      libgl1 \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Bağımlılıklar önce (layer cache): requirements değişmedikçe pip adımı cache'ten gelir.
# --retries/--timeout: paddlepaddle wheel'i büyük; yavaş/kesintili ağda indirme kopmasına
# karşı dayanıklılık (CI + emülasyonlu yerel build için).
COPY requirements.txt .
RUN pip install --no-cache-dir --retries 5 --timeout 180 -r requirements.txt

# Uygulama kodu.
COPY extractor.py main.py ./

# Modelleri İMAJA GÖM: warmup ile det+rec+textline modelleri /root/.paddlex altına iner
# ve bu layer'a yazılır → runtime'da indirme yok, çevrimdışı, hızlı cold start.
ENV PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True
RUN python -c "import numpy as np; from paddleocr import PaddleOCR; \
ocr = PaddleOCR(lang='tr', use_doc_orientation_classify=False, use_doc_unwarping=False, use_textline_orientation=True); \
ocr.predict(np.full((64, 240, 3), 255, np.uint8))"

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--log-level", "warning"]
