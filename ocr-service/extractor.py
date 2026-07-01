"""
TR araç tescil belgesi (ruhsat) alan çıkarıcısı — ETİKET-ÇAPALI.

PaddleOCR'ın döndürdüğü metin kutularından ((text, score, box)) 15 ruhsat alanını
çıkarır. Her alan "(A)", "(D.1)", "(P.3)" gibi standart bir kod etiketiyle işaretli;
değeri, etiketin hemen ALTINDA veya SAĞINDA olan en yakın metin kutusu(ları)dır.
Uzamsal yakınlık + yön öncelikli maliyet ile eşleştirilir.

Çıktı anahtarları Next tarafındaki RegistrationFieldsSchema ile birebir aynıdır.
"""
from __future__ import annotations

import re
from typing import Dict, List, TypedDict


class Box(TypedDict):
    text: str
    score: float
    box: List[int]  # [x1, y1, x2, y2]


# --- 1) etiket kodu tespiti + normalize ---
_LABEL_RE = re.compile(r"^\(([A-Za-zİ0-9.\s]{1,7})\)")


def _norm_code(raw: str) -> str | None:
    """(C.L.I) -> C.1.1 gibi: ilk token harf kalır, sonraki tokenlarda OCR'ın
    I/L->1, O->0 karışması düzeltilir."""
    parts = raw.strip().replace(" ", "").split(".")
    if not parts or not parts[0]:
        return None
    head = parts[0].upper()
    tail = [p.upper().replace("L", "1").replace("I", "1").replace("İ", "1").replace("O", "0") for p in parts[1:]]
    return ".".join([head] + tail)


# --- 2) değer temizleyiciler ---
def _clean_plate(s: str) -> str:
    s = re.sub(r"[^A-Z0-9]", "", s.upper())
    m = re.match(r"(\d{2})([A-Z]{1,3})(\d{2,5})", s)
    return f"{m.group(1)} {m.group(2)} {m.group(3)}" if m else s


def _clean_vin(s: str) -> str:
    s = re.sub(r"[^A-Z0-9]", "", s.upper())
    m = re.search(r"[A-HJ-NPR-Z0-9]{17}", s)
    return m.group(0) if m else s


def _clean_num(s: str) -> str:
    m = re.search(r"\d{2,5}", s)
    return m.group(0) if m else ""


def _clean_power(s: str) -> str:
    n = _clean_num(s)
    return f"{n} kW" if n else ""


def _clean_date(s: str) -> str:
    m = re.search(r"\d{2}[/.\-]\d{2}[/.\-]\d{4}", s)
    return m.group(0).replace("/", ".").replace("-", ".") if m else ""


def _clean_fuel(s: str) -> str:
    up = s.upper()
    for kw in ("DIZEL", "DİZEL", "BENZIN", "BENZİN", "LPG", "ELEKTR", "HIBR", "HİBR", "CNG"):
        if kw in up:
            return {"DIZEL": "DİZEL", "DİZEL": "DİZEL", "BENZIN": "BENZİN", "BENZİN": "BENZİN",
                    "LPG": "LPG", "ELEKTR": "ELEKTRİK", "HIBR": "HİBRİT", "HİBR": "HİBRİT", "CNG": "CNG"}[kw]
    return s.strip()


def _passthru(s: str) -> str:
    return s.strip()


# schema_key -> (aday kodlar öncelik sırasıyla, temizleyici)
_FIELDS = [
    ("plate", ["A"], _clean_plate),
    ("registrationDate", ["1", "B"], _clean_date),  # (I) TESCİL TARİHİ, yoksa (B) İLK TESCİL
    ("ownerSurname", ["C.1.1"], _passthru),
    ("ownerName", ["C.1.2"], _passthru),
    ("brand", ["D.1"], _passthru),
    ("commercialName", ["D.3"], _passthru),
    ("model", ["D.3"], _passthru),
    ("vehicleType", ["D.5"], _passthru),
    ("modelYear", ["D.4"], _clean_num),
    ("vin", ["E"], _clean_vin),
    ("engineNo", ["P.5"], _passthru),
    ("fuelType", ["P.3"], _clean_fuel),
    ("engineDisplacement", ["P.1"], _clean_num),
    ("enginePower", ["P.2"], _clean_power),
    ("inspectionValidUntil", ["Z.2"], _clean_date),
]

# Boş default (RegistrationFieldsSchema ile aynı 15 anahtar)
EMPTY_FIELDS = {k: "" for k, _c, _f in _FIELDS}


def extract(boxes: List[Box]) -> Dict:
    """PaddleOCR kutularından alanları çıkarır.
    Döner: {"fields": {...15...}, "confidence": {...}, "rawText": "..."}"""
    items = []
    for b in boxes:
        x1, y1, x2, y2 = b["box"]
        m = _LABEL_RE.match(b["text"])
        items.append({
            "text": b["text"], "score": float(b["score"]),
            "x1": x1, "y1": y1, "x2": x2, "y2": y2,
            "code": _norm_code(m.group(1)) if m else None,
        })

    labels = [i for i in items if i["code"]]
    values = [i for i in items if not i["code"]]

    def assign(v) -> str | None:
        best, best_cost = None, 1e9
        for lab in labels:
            dy = v["y1"] - lab["y1"]
            dx = v["x1"] - lab["x1"]
            # değer etiketin üstünde / çok solunda / bir satırdan fazla altında olamaz
            if dy < -8 or dy > 60 or dx < -45:
                continue
            cost = dy + max(0, dx) * 0.3  # doğrudan alt tercih; sonra sağ
            if cost < best_cost:
                best_cost, best = cost, lab
        return best["code"] if best else None

    cells: Dict[str, list] = {}
    for v in values:
        c = assign(v)
        if c:
            cells.setdefault(c, []).append(v)

    def cell_text(code: str):
        vs = sorted(cells.get(code, []), key=lambda v: (v["y1"], v["x1"]))
        text = " ".join(v["text"] for v in vs).strip()
        conf = min((v["score"] for v in vs), default=0.0)
        return text, conf

    fields: Dict[str, str] = dict(EMPTY_FIELDS)
    confidence: Dict[str, float] = {k: 0.0 for k in EMPTY_FIELDS}
    for key, codes, cleaner in _FIELDS:
        for code in codes:
            raw, conf = cell_text(code)
            if raw:
                val = cleaner(raw)
                if val:
                    fields[key] = val
                    confidence[key] = round(conf, 3)
                break

    raw_text = "\n".join(
        i["text"] for i in sorted(items, key=lambda i: (i["y1"], i["x1"]))
    )
    return {"fields": fields, "confidence": confidence, "rawText": raw_text}
