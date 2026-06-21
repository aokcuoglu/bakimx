#!/usr/bin/env python3
"""
Ruhsat referans görseli üzerinde her alanın bounding box'ını işaretleme aracı.

Kullanım:
  python scripts/define_regions.py --image ./ruhsat_referans.jpg --output ./template.json

Talimatlar:
  1. Görsel açılır. Her alan için sırayla kutu çizeceksin.
  2. Kutunun SOL-ÜST köşesine tıkla, sürükle, SAĞ-ALT köşede bırak.
  3. 'n' → sonraki alan
  4. 'r' → şu anki alanı yeniden çiz
  5. 's' → kaydet ve çık
  6. 'q' → kaydetmeden çık
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np

# Türkçe alan adları ve kodları
FIELDS = [
    ("plate", "PLATE (Plaka)"),
    ("brand", "BRAND (Marka — D.1)"),
    ("model", "MODEL (Model — D.3)"),
    ("vehicleType", "VEHICLE TYPE (Araç Tipi — D.5)"),
    ("modelYear", "MODEL YEAR (Model Yılı — D.4)"),
    ("engineNo", "ENGINE NO (Motor No — P.5)"),
    ("vin", "VIN (Şase No — E)"),
    ("ownerName", "OWNER NAME (Adı — C.1.2)"),
    ("ownerSurname", "OWNER SURNAME (Soyadı — C.1.1)"),
    ("registrationDate", "REG. DATE (Tescil Tarihi — I)"),
]

COLORS = [
    (0, 255, 0),    # plate - green
    (255, 0, 0),    # brand - blue
    (0, 0, 255),    # model - red
    (255, 255, 0),  # vehicleType - cyan
    (255, 0, 255),  # modelYear - magenta
    (0, 255, 255),  # engineNo - yellow
    (128, 0, 128),  # vin - purple
    (0, 128, 128),  # ownerName - teal
    (128, 128, 0),  # ownerSurname - olive
    (200, 100, 0),  # registrationDate - orange
]


class RegionMarker:
    def __init__(self, image_path: Path, output_path: Path):
        self.image_path = image_path
        self.output_path = output_path
        self.img = cv2.imread(str(image_path))
        if self.img is None:
            raise RuntimeError(f"Görsel yüklenemedi: {image_path}")

        self.height, self.width = self.img.shape[:2]
        # Büyük görselleri ekrana sığdırmak için ölçekle
        self.scale = 1.0
        max_display = 1200
        if max(self.width, self.height) > max_display:
            self.scale = max_display / max(self.width, self.height)
            display_w = int(self.width * self.scale)
            display_h = int(self.height * self.scale)
            self.display = cv2.resize(self.img, (display_w, display_h))
        else:
            self.display = self.img.copy()

        self.overlay = self.display.copy()
        self.rects: dict[str, tuple[int, int, int, int]] = {}  # field_name -> (x1,y1,x2,y2) in original coords
        self.current_field_idx = 0
        self.drawing = False
        self.pt1 = (-1, -1)
        self.pt2 = (-1, -1)
        self.window_name = "Ruhsat Alan İşaretleme"
        cv2.namedWindow(self.window_name)
        cv2.setMouseCallback(self.window_name, self.mouse_callback)

    def to_display(self, x: int, y: int) -> tuple[int, int]:
        """Orijinal koordinatı display koordinatına çevir."""
        return int(x * self.scale), int(y * self.scale)

    def to_original(self, x: int, y: int) -> tuple[int, int]:
        """Display koordinatını orijinale çevir."""
        return int(x / self.scale), int(y / self.scale)

    def mouse_callback(self, event: int, x: int, y: int, flags: int, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            self.drawing = True
            self.pt1 = (x, y)
            self.pt2 = (x, y)
        elif event == cv2.EVENT_MOUSEMOVE and self.drawing:
            self.pt2 = (x, y)
            self.redraw()
        elif event == cv2.EVENT_LBUTTONUP:
            self.drawing = False
            self.pt2 = (x, y)
            self.redraw()

    def redraw(self):
        self.overlay = self.display.copy()

        # Daha önce işaretlenmiş alanları çiz
        for idx, (name, label) in enumerate(FIELDS):
            if name in self.rects:
                x1, y1, x2, y2 = self.rects[name]
                dx1, dy1 = self.to_display(x1, y1)
                dx2, dy2 = self.to_display(x2, y2)
                color = COLORS[idx % len(COLORS)]
                cv2.rectangle(self.overlay, (dx1, dy1), (dx2, dy2), color, 2)
                cv2.putText(self.overlay, name, (dx1, dy1 - 5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)

        # Şu an çizilen dikdörtgen
        if self.drawing or (self.pt1[0] >= 0 and self.pt2[0] >= 0):
            cv2.rectangle(self.overlay, self.pt1, self.pt2, (255, 255, 255), 2)

        # Talimat metni
        name, label = FIELDS[self.current_field_idx]
        if name not in self.rects:
            status = f"[{self.current_field_idx + 1}/{len(FIELDS)}] {label}"
        else:
            status = f"[{self.current_field_idx + 1}/{len(FIELDS)}] {label} (kaydedildi)"
        if self.drawing:
            status += " — Fareyi sürükleyin..."

        cv2.putText(self.overlay, status, (10, 25),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        # Klavye kısayolları
        cv2.putText(self.overlay, "[n] Sonraki  [r] Yeniden  [s] Kaydet  [q] Çık",
                    (10, self.overlay.shape[0] - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)

        cv2.imshow(self.window_name, self.overlay)

    def run(self):
        print(f"Görsel: {self.image_path}")
        print(f"Çözünürlük: {self.width}x{self.height}")
        print(f"\n{len(FIELDS)} alanı sırayla işaretleyeceksin.")
        print("Her alan için: SOL-ÜST köşeye tıkla, sürükle, SAĞ-ALT köşede bırak.")
        print("Kısayollar: [n]=ileri  [r]=yeniden  [s]=kaydet  [q]=çık\n")

        name, label = FIELDS[self.current_field_idx]
        print(f"Şimdi: {label}")

        self.redraw()

        while True:
            key = cv2.waitKey(1) & 0xFF

            if key == ord('n') or key == 13:  # 'n' veya Enter
                # Dikdörtgeni kaydet
                if self.pt1[0] >= 0 and self.pt2[0] >= 0:
                    x1, y1 = self.to_original(min(self.pt1[0], self.pt2[0]),
                                               min(self.pt1[1], self.pt2[1]))
                    x2, y2 = self.to_original(max(self.pt1[0], self.pt2[0]),
                                               max(self.pt1[1], self.pt2[1]))
                    name, _ = FIELDS[self.current_field_idx]
                    self.rects[name] = (x1, y1, x2, y2)
                    # Kutudan sonraki tek satırlık OCR için yüksekliği optimize et
                    print(f"  {name}: ({x1},{y1}) → ({x2},{y2})")

                # Sonraki alana geç
                if self.current_field_idx < len(FIELDS) - 1:
                    self.current_field_idx += 1
                    self.pt1 = (-1, -1)
                    self.pt2 = (-1, -1)
                    name, label = FIELDS[self.current_field_idx]
                    print(f"Şimdi: {label}")
                else:
                    print("Tüm alanlar işaretlendi. Kaydetmek için [s].")

                self.redraw()

            elif key == ord('r'):  # 'r' → yeniden çiz
                self.pt1 = (-1, -1)
                self.pt2 = (-1, -1)
                name, label = FIELDS[self.current_field_idx]
                print(f"Yeniden: {label}")
                self.redraw()

            elif key == ord('s'):  # 's' → kaydet
                self.save()
                return

            elif key == ord('q'):  # 'q' → çık
                print("Kaydedilmeden çıkılıyor.")
                cv2.destroyAllWindows()
                return

    def save(self):
        # Kaydedilmeyen mevcut dikdörtgeni de ekle
        if self.pt1[0] >= 0 and self.pt2[0] >= 0:
            x1, y1 = self.to_original(min(self.pt1[0], self.pt2[0]),
                                       min(self.pt1[1], self.pt2[1]))
            x2, y2 = self.to_original(max(self.pt1[0], self.pt2[0]),
                                       max(self.pt1[1], self.pt2[1]))
            name, _ = FIELDS[self.current_field_idx]
            self.rects[name] = (x1, y1, x2, y2)

        template: dict = {
            "reference_image": str(self.image_path),
            "reference_width": self.width,
            "reference_height": self.height,
            "fields": {},
        }

        for name, _ in FIELDS:
            if name in self.rects:
                x1, y1, x2, y2 = self.rects[name]
                template["fields"][name] = {
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2,
                    "psm": 7,  # SINGLE_LINE varsayılan
                }

        # İşaretlenmeyen alanları uyar
        missing = [name for name, _ in FIELDS if name not in self.rects]
        if missing:
            print(f"UYARI: Şu alanlar işaretlenmedi: {', '.join(missing)}")

        self.output_path.write_text(json.dumps(template, indent=2, ensure_ascii=False))
        print(f"Template kaydedildi: {self.output_path}")
        print(f"  {len(template['fields'])} alan, referans {self.width}x{self.height}")
        cv2.destroyAllWindows()


def main():
    parser = argparse.ArgumentParser(description="Ruhsat referans görseli üzerinde alanları işaretle")
    parser.add_argument("--image", required=True, type=Path, help="Referans ruhsat görsel yolu")
    parser.add_argument("--output", default="template.json", type=Path, help="Çıktı template JSON yolu")
    args = parser.parse_args()

    if not args.image.exists():
        print(f"HATA: Görsel bulunamadı: {args.image}", file=sys.stderr)
        return 2

    try:
        marker = RegionMarker(args.image, args.output)
        marker.run()
    except Exception as exc:
        print(f"HATA: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
