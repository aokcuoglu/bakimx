#!/usr/bin/env python3
"""
BakimX ruhsat OCR CLI — Tesseract + regex parser.

DeepSeek/LLM kullanmadan, yalnızca Tesseract ham metnini regex ile
yapısal alanlara çevirir. Maliyet sıfır, çevrimdışı çalışır.

Kullanım:
  python scripts/registration_ocr.py --image ./ruhsat.jpg
  python scripts/registration_ocr.py --image ./ruhsat.heic --output text

Kurulum:
  brew install tesseract tesseract-lang
  pip install -r scripts/requirements.txt
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date
from io import BytesIO
from pathlib import Path
from typing import Any

import pytesseract
from PIL import Image, ImageOps
from pydantic import BaseModel

try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
    HEIF_AVAILABLE = True
except ImportError:
    HEIF_AVAILABLE = False


# --- Sabitler (types.ts ile birebir) ---------------------------------------

MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024
SUPPORTED_IMAGE_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
}
HEIC_MIME_TYPES = {"image/heic", "image/heif"}


# --- Şema (registration-result.ts) ----------------------------------------

class RegistrationFields(BaseModel):
    plate: str = ""
    vin: str = ""
    ownerName: str = ""
    ownerSurname: str = ""
    brand: str = ""
    model: str = ""
    vehicleType: str = ""
    modelYear: str = ""
    engineNo: str = ""
    registrationDate: str = ""


# --- Görsel hazırlama (prepare + normalize) -------------------------------

def _detect_mime(path: Path) -> str:
    ext = path.suffix.lower()
    if ext in (".heic",):
        return "image/heic"
    if ext in (".heif",):
        return "image/heif"
    if ext in (".jpg", ".jpeg"):
        return "image/jpeg"
    if ext == ".png":
        return "image/png"
    if ext == ".webp":
        return "image/webp"
    return "image/jpeg"


def prepare_image(path: Path) -> tuple[bytes, str]:
    """Boyut kontrolü + HEIC→JPEG dönüşümü. (prepare-registration-image.ts + normalize)"""
    mime = _detect_mime(path)
    if mime not in SUPPORTED_IMAGE_MIME_TYPES:
        raise RuntimeError("Lütfen JPEG, PNG, WebP veya HEIC biçiminde bir görsel seçin.")

    raw = path.read_bytes()
    if len(raw) > MAX_IMAGE_SIZE_BYTES:
        raise RuntimeError(
            f"Görsel {MAX_IMAGE_SIZE_BYTES // 1024 // 1024} MB'dan küçük olmalıdır."
        )

    if mime in HEIC_MIME_TYPES:
        if not HEIF_AVAILABLE:
            raise RuntimeError(
                "HEIC desteği için pillow-heif kurulmalı: pip install pillow-heif"
            )
        try:
            img = Image.open(BytesIO(raw))
            buf = BytesIO()
            img.convert("RGB").save(buf, format="JPEG", quality=90)
            jpeg = buf.getvalue()
            if len(jpeg) > MAX_IMAGE_SIZE_BYTES:
                raise RuntimeError(
                    f"Dönüştürülen görsel {MAX_IMAGE_SIZE_BYTES // 1024 // 1024} MB sınırını aşıyor."
                )
            return jpeg, "image/jpeg"
        except RuntimeError:
            raise
        except Exception as exc:
            print(f"[HEIC CONVERSION ERROR] {exc}", file=sys.stderr)
            raise RuntimeError(
                "HEIC fotoğrafı dönüştürülemedi. Lütfen JPEG olarak paylaşın."
            )

    return raw, mime


def load_pil_image(buffer: bytes) -> Image.Image:
    """Pillow görseli — exif oto-rotate ile (TS prepareRegistrationImage karşılığı)."""
    img = Image.open(BytesIO(buffer))
    img = ImageOps.exif_transpose(img)  # orientation düzelt
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    return img


# --- Tesseract (tesseract-text-extractor.ts) ------------------------------

def extract_text(image_buffer: bytes) -> str:
    """Tesseract tur+eng, PSM 12 (SPARSE_TEXT), 300 DPI, preserve_interword_spaces."""
    img = load_pil_image(image_buffer)
    # PSM 12 = SPARSE_TEXT, preserve_interword_spaces=1, user_defined_dpi=300
    config = "--psm 12 --dpi 300 -c preserve_interword_spaces=1"
    text = pytesseract.image_to_string(img, lang="tur+eng", config=config)
    text = text.strip()
    if not text:
        raise RuntimeError("Ruhsat fotoğrafından okunabilir metin çıkarılamadı")
    return text


# --- Regex parser (DeepSeek yerine) --------------------------------------

# Etiket → alan eşlemi. Her regex bir capturing group içerir: etiket+kelime
# kısmını yakalayıp `re.split` ile değeri ayırırız.
#
# OCR toleransı:
#   - D[.,]?1 → D1 / D,1 / D.1 / DI (I=1), DS (S≈3): D[.,\s]?[1lI|3Ss]
#   - C.1.1 → C kaybolabilir: [C.]?1.1
#   - I TESCİL → I kaybolabilir: TESCİL direkt
#   - Ü/İ/Ö/Ş/Ç → ASCII muadilleri de kabul (OCR eski fontlar)
LABEL_PATTERNS: list[tuple[str, str]] = [
    # brand: D.1 / D1 / D,1 / DI MARKASI / D1MARKASI
    ("brand",
     r"(D[.,\s]?[1lI|]\s*[^\n]*?(?:MARKA(?:S[İIY1]*)?))", re.IGNORECASE),
    # model: D.3 / D3 / DS TİCARİ ADI / DS TICARIAD
    ("model",
     r"(D[.,\s]?[3Ss8]\s*[^\n]*?(?:T[İI1]CAR[İI1]\s*AD(?:[LIY1]*[İI1]*)?))",
     re.IGNORECASE),
    # vehicleType: D.5 / D5 / DE / DS CİNSİ (5≈E, 5≈S)
    ("vehicleType",
     r"(D[.,\s]?[5SsEe]\s*[^\n]*?(?:C[İI1]NS[İI1](?:[LIY1]*[İI1]*)?))",
     re.IGNORECASE),
    # modelYear: D.4 / D4 MODEL YILI
    ("modelYear",
     r"(D[.,\s]?[4]\s*[^\n]*?(?:MODEL\s*YIL[İI1](?:[LIY1]*[İI1]*)?))",
     re.IGNORECASE),
    # engineNo: P.5 / P5 / PS / PE MOTOR NO (5≈S, 5≈E)
    ("engineNo",
     r"(P[.,\s]?[5SsEe]\s*[^\n]*?(?:MOTOR\s*(?:N[O0]\b)?))", re.IGNORECASE),
    # vin: E ŞASE NO / EŞASE NO / E SASE / SASE / ŞASE (E drop tolerant)
    ("vin",
     r"(E?\s*[^\n]*?(?:Ş?ASE\s*(?:N[O0]\b)?|[ÇC]ASE\s*(?:N[O0]\b)?))",
     re.IGNORECASE),
    # ownerName: C.1.2 / C12 / 1.2 / .1.2 ADI (C drop tolerant)
    ("ownerName",
     r"([C.]?[.,\s]?1[.,\s]?2\s*[^\n]*?(?:AD(?:[LIY1]*[İI1]*)?))",
     re.IGNORECASE),
    # ownerSurname: C.1.1 / 1.1 SOYADI (C drop tolerant)
    ("ownerSurname",
     r"([C.]?[.,\s]?1[.,\s]?1\s*[^\n]*?(?:SOYAD(?:[LIY1]*[İI1]*)?|[ÜU]NVAN(?:L[IG1]*[ĞI1]*)?))",
     re.IGNORECASE),
    # registrationDate: I TESCİL / TESCİL / TESC1L TARİHİ (I drop tolerant)
    # TAR[İI1]HM (H yerine M — OCR hatası "TARIMI" gibi)
    ("registrationDate",
     r"(I?\s*[^\n]*?(?:TESC[İI1]L\s*TAR[İI1][HM][İI1](?:[İI1][ÇC1]*)?))",
     re.IGNORECASE),
]

# Plaka: Türk formatı — 2 rakam, 1-3 harf, 2-4 rakam (ör: 35 CCZ 618, 06 J 1234)
# OCR hataları: C↔0 (35 C0Z), 0↔O, boşluk kaybolabilir (35CCZ618)
PLATE_RE = re.compile(
    r"\b(\d{2}\s?[0OQCBGÇĞİÖŞÜA-Z]{1,3}\s?\d{2,4})\b"
)


def _clean_label_line(line: str, pattern: re.Pattern) -> str:
    """Etiket satırından değer kısmını ayır.

    Regex bir capturing group içerir; `re.split` grup eşleşmesini de döndürür:
    [önce, eşleşme, sonra]. Son segment değeri verir. Önce etiket kelimesini
    (MARKASI vb.) tam yakaladığımızdan değer segmentinde artık kalmaz.
    """
    parts = pattern.split(line, maxsplit=1)
    if len(parts) >= 3:
        # parts: [öncesi, eşleşen_etiket, sonrası] → değer = sonrası
        value = parts[-1]
    elif len(parts) == 2:
        # regex eşleşti ama capturing group'suz kaldı (olmamalı): yine de son segment
        value = parts[-1]
    else:
        value = ""
    return value.strip(" :.\-=|\t")


def _strip_nonvalue_chars(s: str) -> str:
    """Baştaki/sondaki işaret ve etiket artıklarını temizle."""
    s = re.sub(r"^[\s:,.\-=|!@#$%^&*]+", "", s)
    s = re.sub(r"[\s:,.\-=|!@#$%^&*]+$", "", s)
    # Etiket kelimesinin OCR hatasından kalan parçası ("1", "N0" başta vb.)
    s = re.sub(r"^[1I0N][\s]+(?=[A-ZÇĞİÖŞÜ0-9]{2,})", "", s, flags=re.IGNORECASE)
    return s.strip()


def parse_fields_regex(raw_text: str) -> RegistrationFields:
    """Ham Tesseract metnini regex ile yapısal alanlara çevirir (DeepSeek yerine)."""
    lines = [ln.strip() for ln in raw_text.splitlines() if ln.strip()]
    fields = RegistrationFields()

    # Plaka: tüm metinde ilk eşleşen
    plate_match = PLATE_RE.search(raw_text)
    if plate_match:
        fields.plate = plate_match.group(1).strip()

    # Etiket bazlı alan tarama
    for field_name, pattern_str, flags in LABEL_PATTERNS:
        pattern = re.compile(pattern_str, flags)
        value = ""
        for i, line in enumerate(lines):
            m = pattern.search(line)
            if not m:
                continue
            # Önce aynı satırda etiket sonrası değer var mı?
            value = _strip_nonvalue_chars(_clean_label_line(line, pattern))
            if value:
                break
            # Aynı satırda değer boşsa sonraki non-empty satırı değer al
            for nxt in lines[i + 1: i + 4]:
                cand = _strip_nonvalue_chars(nxt)
                # sonraki satır da başka bir etiket ise atlama
                if cand and not _is_label_line(cand):
                    value = cand
                    break
            if value:
                break
        setattr(fields, field_name, value)

    return fields


# Etiket satırı tespiti — "sonraki satırı değer al" sırasında etikete atlamamak için
_LABEL_KEYWORDS_RE = re.compile(
    r"\b(?:MARKA|MARKASI|T[İI]CAR[İI]\s*AD|C[İI]NS[İI]|MODEL\s*YILI|MOTOR|Ş?ASE|"
    r"SOYAD[LI]?|[ÜU]NVAN|TESC[İI]L|TAR[İI]H|D[.,]?\s*\d|C[.,]?\s*1|P[.,]?\s*\d|"
    r"^\s*E\b|^\s*I\b)",
    re.IGNORECASE,
)


def _is_label_line(line: str) -> bool:
    """Satır bir etiket/kod satırı mı? Değer olarak almayalım."""
    # Tamamen etiket ise (içinde gerçek değer yok)
    if _LABEL_KEYWORDS_RE.search(line) and len(line) < 40:
        return True
    return False


# --- reconcileFields (deepseek-ocr-provider.ts) --------------------------

MODEL_YEAR_LABEL_RE = re.compile(r"\bD[.,]?\s*4\b|MODEL\s+YILI", re.IGNORECASE)
YEAR_RE = re.compile(r"\b(?:19|20)\d{2}\b")


def extract_model_year(raw_text: str) -> str | None:
    lines = raw_text.splitlines()
    label_index = -1
    for i, line in enumerate(lines):
        if MODEL_YEAR_LABEL_RE.search(line):
            label_index = i
            break
    if label_index == -1:
        return None
    current_year = date.today().year
    nearby = " ".join(lines[label_index: label_index + 10])
    years = YEAR_RE.findall(nearby)
    for y in years:
        n = int(y)
        if 1900 <= n <= current_year + 1:
            return y
    return None


def reconcile_fields(fields: RegistrationFields, raw_text: str) -> RegistrationFields:
    """Regex parser modelYear boş bıraktıysa Tesseract metninden düzelt."""
    if not fields.modelYear:
        yr = extract_model_year(raw_text)
        if yr:
            fields.modelYear = yr
    return fields


# --- toRegistrationResult (registration-result.ts) ------------------------

def to_result(fields: RegistrationFields, raw_text: str) -> dict[str, Any]:
    """Plate/vin/engineNo uppercase; owner* korunsun; rawText trim."""
    return {
        "plate": fields.plate.upper().strip(),
        "vin": fields.vin.upper().strip(),
        "ownerName": fields.ownerName.strip(),
        "ownerSurname": fields.ownerSurname.strip(),
        "brand": fields.brand.strip(),
        "model": fields.model.strip(),
        "vehicleType": fields.vehicleType.strip(),
        "modelYear": fields.modelYear.strip(),
        "engineNo": fields.engineNo.upper().strip(),
        "registrationDate": fields.registrationDate.strip(),
        "rawText": raw_text.strip(),
        "provider": "tesseract-regex",
    }


# --- Ana akış -------------------------------------------------------------

def run_ocr(image_path: Path) -> dict[str, Any]:
    buffer, _mime = prepare_image(image_path)
    raw_text = extract_text(buffer)
    fields = parse_fields_regex(raw_text)
    fields = reconcile_fields(fields, raw_text)
    return to_result(fields, raw_text)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="BakimX ruhsat OCR — Tesseract + regex (DeepSeek gerektirmez)"
    )
    parser.add_argument("--image", required=True, type=Path, help="Ruhsat görsel yolu")
    parser.add_argument("--output", choices=["json", "text"], default="json",
                        help="Çıktı formatı (json veya text)")
    args = parser.parse_args()

    if not args.image.exists():
        print(f"HATA: Görsel bulunamadı: {args.image}", file=sys.stderr)
        return 2

    try:
        result = run_ocr(args.image)
    except Exception as exc:
        print(f"HATA: {exc}", file=sys.stderr)
        return 1

    if args.output == "text":
        for key in ("plate", "vin", "ownerName", "ownerSurname", "brand",
                    "model", "vehicleType", "modelYear", "engineNo", "registrationDate"):
            print(f"{key:18s}: {result[key]}")
        print(f"{'provider':18s}: {result['provider']}")
        print("---")
        print(result["rawText"])
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())