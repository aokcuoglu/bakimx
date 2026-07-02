"""
BakımX ruhsat OCR sidecar servisi (PaddleOCR).

Uzun ömürlü FastAPI süreci; PaddleOCR modellerini başlangıçta BİR KEZ yükler ve
sıcak tutar, böylece her çağrı ~1-2 sn'de döner. Next.js tarafı bu servisi
localhost HTTP ile çağırır (bkz. src/lib/ocr/paddle-ocr-provider.ts).

Çalıştırma (dev):
    cd ocr-service
    python3 -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    uvicorn main:app --host 127.0.0.1 --port 8000
"""
import os

# PaddleX model-hoster bağlantı kontrolünü atla → daha hızlı/çevrimdışı başlangıç.
os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
# oneDNN'i kapat: native x86_64'te paddle 3.x + PIR executor oneDNN yolunda çöküyor
# (onednn_instruction.cc). Docker ENV zaten ayarlıyor; bu bare-uvicorn/linux dev yolu için.
os.environ.setdefault("FLAGS_use_mkldnn", "0")

from contextlib import asynccontextmanager  # noqa: E402

import cv2  # noqa: E402
import numpy as np  # noqa: E402
from fastapi import FastAPI, File, HTTPException, UploadFile  # noqa: E402

from extractor import extract  # noqa: E402

_STATE: dict = {}


def _load_ocr():
    from paddleocr import PaddleOCR

    # lang="tr": Türkçe latin tanıma modeli. Yön sınıflandırma açık (hafif eğik satırlar için).
    return PaddleOCR(
        lang="tr",
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=True,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    _STATE["ocr"] = _load_ocr()  # modelleri başlangıçta yükle (cold start burada)
    yield
    _STATE.clear()


app = FastAPI(title="BakımX Ruhsat OCR", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok", "ready": "ocr" in _STATE, "engine": "paddleocr", "lang": "tr"}


@app.post("/ocr")
async def ocr(image: UploadFile = File(...)):
    ocr_engine = _STATE.get("ocr")
    if ocr_engine is None:
        raise HTTPException(status_code=503, detail="OCR motoru henüz hazır değil")

    data = await image.read()
    if not data:
        raise HTTPException(status_code=400, detail="Boş görsel")

    arr = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if arr is None:
        raise HTTPException(status_code=400, detail="Görsel çözülemedi (desteklenmeyen biçim)")

    boxes = []
    for page in ocr_engine.predict(arr) or []:
        texts = page.get("rec_texts", [])
        scores = page.get("rec_scores", [])
        rec_boxes = page.get("rec_boxes", [])
        for t, s, b in zip(texts, scores, rec_boxes):
            boxes.append({"text": t, "score": float(s), "box": [int(v) for v in list(b)]})

    result = extract(boxes)
    result["provider"] = "paddle"
    result["boxCount"] = len(boxes)
    return result
