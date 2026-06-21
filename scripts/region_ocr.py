#!/usr/bin/env python3
"""
Ruhsat görselini referans template'e hizalayıp bölgesel OCR ile oku.

Kullanım:
  python scripts/region_ocr.py --image ./yeni_ruhsat.jpg --template ./template.json

Akış:
  1. Template JSON yükle (define_regions.py çıktısı)
  2. Yeni görseli referansa hizala (ORB feature matching + homography)
  3. Template'deki her bölgeyi kırp
  4. Her bölgeyi ayrı ayrı OCR ile oku (--psm 7)
  5. Sonuçları JSON olarak yazdır

Ön koşul:
  pip install opencv-python pytesseract Pillow numpy
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np
import pytesseract
from PIL import Image


def load_template(path: Path) -> dict:
    template = json.loads(path.read_text())
    required = {"reference_image", "reference_width", "reference_height", "fields"}
    if not required.issubset(template):
        raise RuntimeError(f"Geçersiz template: {required - set(template)} eksik")
    return template


def load_image(path: Path, max_dim: int = 2000) -> tuple[np.ndarray, float]:
    """Görseli yükle, max_dim'e ölçekle, scale döndür."""
    img = cv2.imread(str(path))
    if img is None:
        raise RuntimeError(f"Görsel yüklenemedi: {path}")
    h, w = img.shape[:2]
    scale = min(max_dim / max(h, w), 1.0)
    if scale < 1.0:
        new_w, new_h = int(w * scale), int(h * scale)
        img = cv2.resize(img, (new_w, new_h))
    return img, scale


def align_images(
    target: np.ndarray,
    reference: np.ndarray,
    min_match_count: int = 15,
) -> np.ndarray | None:
    """ORB feature matching ile target'ı reference'a hizala. Warped görsel döndür."""
    gray_target = cv2.cvtColor(target, cv2.COLOR_BGR2GRAY)
    gray_ref = cv2.cvtColor(reference, cv2.COLOR_BGR2GRAY)

    orb = cv2.ORB_create(nfeatures=5000, scaleFactor=1.2, nlevels=10)
    kp1, des1 = orb.detectAndCompute(gray_target, None)
    kp2, des2 = orb.detectAndCompute(gray_ref, None)

    if des1 is None or des2 is None:
        return None

    # FLANN matcher for ORB
    index_params = dict(algorithm=6, table_number=12, key_size=12, multi_probe_level=2)
    search_params = dict(checks=50)
    flann = cv2.FlannBasedMatcher(index_params, search_params)
    matches = flann.knnMatch(des1, des2, k=2)

    # Lowe's ratio test
    good_matches = [m for m, n in matches if m.distance < 0.75 * n.distance]

    if len(good_matches) < min_match_count:
        return None

    src_pts = np.float32([kp1[m.queryIdx].pt for m in good_matches]).reshape(-1, 1, 2)
    dst_pts = np.float32([kp2[m.trainIdx].pt for m in good_matches]).reshape(-1, 1, 2)

    matrix, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)
    if matrix is None:
        return None

    h, w = reference.shape[:2]
    warped = cv2.warpPerspective(target, matrix, (w, h))
    return warped


def preprocess_crop(crop: np.ndarray) -> np.ndarray:
    """Tek bir OCR bölgesini ön işleme: grayscale, threshold, denoise."""
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    # Görüntüyü büyüt (Tesseract küçük metinlerde zorlanır)
    h, w = gray.shape
    if h < 40 or w < 100:
        scale = max(40 / h, 100 / w, 2.0)
        gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    # Otsu threshold
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    # Gürültü temizleme
    denoised = cv2.medianBlur(binary, 1)
    return denoised


def ocr_crop(crop: np.ndarray, psm: int = 7, config_extra: str = "") -> str:
    """Kırpılmış bölgeyi OCR ile oku."""
    if crop.size == 0:
        return ""

    processed = preprocess_crop(crop)
    pil_img = Image.fromarray(processed)

    custom_config = f"--psm {psm} --oem 3 -l tur+eng {config_extra}"
    text = pytesseract.image_to_string(pil_img, config=custom_config)

    return text.strip()


def clean_ocr_text(field_name: str, raw: str) -> str:
    """Alan tipine göre OCR çıktısını temizle."""
    text = raw.strip().replace("\n", " ").replace("|", "").strip()
    text = " ".join(text.split())  # multiple spaces → single

    if field_name == "plate":
        text = text.replace(" ", "").upper()
    elif field_name == "vin":
        text = text.replace(" ", "").upper()
    elif field_name == "engineNo":
        text = text.replace(" ", "").upper()
    elif field_name in ("brand", "model", "vehicleType", "ownerName", "ownerSurname"):
        text = text.upper()
    elif field_name == "modelYear":
        digits = "".join(ch for ch in text if ch.isdigit())
        text = digits[:4]

    return text


def ocr_field(crop: np.ndarray, field_config: dict) -> dict:
    """Bir alanı OCR ile oku, temizlenmiş metin ve güven skoru döndür."""
    psm = field_config.get("psm", 7)
    raw = ocr_crop(crop, psm=psm)
    name = field_config.get("_name", "unknown")

    # Confidence için Tesseract'ın conf verisini al
    processed = preprocess_crop(crop)
    pil_img = Image.fromarray(processed)
    custom_config = f"--psm {psm} --oem 3 -l tur+eng"
    data = pytesseract.image_to_data(pil_img, config=custom_config, output_type=pytesseract.Output.DICT)

    confs = [c for c in data["conf"] if c != -1]
    avg_conf = round(sum(confs) / len(confs), 1) if confs else 0.0

    cleaned = clean_ocr_text(name, raw)
    return {"raw": raw, "text": cleaned, "confidence": avg_conf}


def main():
    parser = argparse.ArgumentParser(description="Ruhsat görselini template ile bölgesel oku")
    parser.add_argument("--image", "-i", required=True, type=Path, help="Ruhsat görsel yolu")
    parser.add_argument("--template", "-t", required=True, type=Path, help="Template JSON yolu")
    parser.add_argument("--output", "-o", type=Path, help="Çıktı JSON dosyası (yoksa stdout)")
    parser.add_argument("--min-matches", type=int, default=15, help="Min. feature match sayısı")
    parser.add_argument("--no-align", action="store_true", help="Hizalama yapma, raw kırp")
    args = parser.parse_args()

    if not args.image.exists():
        print(f"HATA: Görsel bulunamadı: {args.image}", file=sys.stderr)
        return 2
    if not args.template.exists():
        print(f"HATA: Template bulunamadı: {args.template}", file=sys.stderr)
        return 2

    # Template yükle
    template = load_template(args.template)
    ref_img_path = Path(template["reference_image"])
    if not ref_img_path.exists():
        print(f"UYARI: Referans görsel bulunamadı: {ref_img_path}", file=sys.stderr)
        print("Hizalama yapılamayacak, raw kırp kullanılacak.")
        args.no_align = True

    print(f"Template: {args.template}")
    print(f"  Referans: {ref_img_path} ({template['reference_width']}x{template['reference_height']})")
    print(f"  Alan sayısı: {len(template['fields'])}")

    # Görsel yükle
    img, img_scale = load_image(args.image)
    print(f"  Hedef: {args.image} ({img.shape[1]}x{img.shape[0]})")

    # Referans yükle
    result: dict[str, dict] = {}

    if not args.no_align:
        reference = cv2.imread(str(ref_img_path))
        ref_scale = 1.0
        ref_max_dim = 2000
        h, w = reference.shape[:2]
        if max(w, h) > ref_max_dim:
            ref_scale = ref_max_dim / max(w, h)
            reference = cv2.resize(reference, (int(w * ref_scale), int(h * ref_scale)))

        print("Hizalama başlatılıyor...")
        warped = align_images(img, reference, min_match_count=args.min_matches)

        if warped is not None:
            print("  Hizalama başarılı. Bölgesel OCR...")
            # Template koordinatları referans çözünürlüğünde.
            # Eğer referans ölçeklendiyse, koordinatları da ölçekle.
            coord_scale = ref_scale if ref_scale < 1.0 else 1.0
        else:
            print(f"  Hizalama başarısız (<{args.min_matches} match). Raw kırp deneniyor...")
            warped = img
            coord_scale = 1.0
            # Koordinatları hedef görselin ölçeğine göre ayarla
            if img_scale < 1.0:
                coord_scale = img_scale
    else:
        print("Hizalama atlandı. Raw kırp kullanılıyor.")
        warped = img
        coord_scale = img_scale if img_scale < 1.0 else 1.0

    # Her alanı kırp ve oku
    for field_name, field_config in template["fields"].items():
        x1 = int(field_config["x1"] * coord_scale)
        y1 = int(field_config["y1"] * coord_scale)
        x2 = int(field_config["x2"] * coord_scale)
        y2 = int(field_config["y2"] * coord_scale)

        # Warped boyutlarına sığdır
        h_warp, w_warp = warped.shape[:2]
        x1, x2 = max(0, x1), min(w_warp, x2)
        y1, y2 = max(0, y1), min(h_warp, y2)

        if x2 <= x1 or y2 <= y1:
            print(f"  UYARI: {field_name} — geçersiz kırp bölgesi ({x1},{y1},{x2},{y2})")
            result[field_name] = {"raw": "", "text": "", "confidence": 0.0}
            continue

        crop = warped[y1:y2, x1:x2]
        config_with_name = {**field_config, "_name": field_name}
        field_result = ocr_field(crop, config_with_name)
        result[field_name] = field_result
        print(f"  {field_name}: {field_result['text']} (conf={field_result['confidence']})")

    # Çıktı
    output: dict = {
        "source": str(args.image),
        "template": str(args.template),
        "fields": result,
    }

    output_json = json.dumps(output, indent=2, ensure_ascii=False)
    if args.output:
        args.output.write_text(output_json)
        print(f"\nKaydedildi: {args.output}")
    else:
        print(f"\n{output_json}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
