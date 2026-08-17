/**
 * Landing duyuru barının içeriği.
 *
 * Duyuru değişince bileşen değil bu dosya değişir. `id` aynı zamanda kapatma
 * hafızasının anahtarıdır: yeni bir duyuru yayınlarken `id`'yi de değiştir,
 * aksi halde önceki duyuruyu kapatmış ziyaretçiler yenisini hiç görmez.
 */
export type LandingAnnouncement = {
  /** Kapatma hafızasında saklanan sürüm anahtarı. Her yeni duyuruda değişir. */
  id: string;
  /** Kısa rozet metni (ör. "Yeni"). */
  badge: string;
  /** Tek cümlelik duyuru metni. */
  text: string;
  /** Tıklanabilir CTA'nın etiketi. */
  linkLabel: string;
  /** CTA hedefi — sayfa içi anchor ya da rota. */
  href: string;
};

export const landingAnnouncement: LandingAnnouncement = {
  id: "2026-08-ruhsat-parca",
  badge: "Yeni",
  text: "Ruhsatı okutun, araca uyan parçalar otomatik gelsin.",
  linkLabel: "İncele",
  href: "/#ozellikler",
};

/** Kapatma kararının saklandığı `localStorage` anahtarı. */
export const ANNOUNCEMENT_STORAGE_KEY = "bakimx.announcement.dismissed";

/** Barın DOM işareti — gizleme kuralı bunu hedefler. */
export const ANNOUNCEMENT_BAR_SLOT = "announcement-bar";

/**
 * Kapatılmış duyuruyu ilk boyadan önce gizleyen satır içi script.
 *
 * Hidrasyondan önce, senkron çalışır: kapatmış ziyaretçide bar hiç boyanmaz,
 * dolayısıyla React barı kaldırdığında düzen kaymaz (CLS).
 *
 * Gizlemeyi `<html>` üzerine sınıf ekleyerek DEĞİL, `<head>`e stil enjekte
 * ederek yapar. `<html>`in `className`ini React render ediyor; script onu
 * değiştirseydi hidrasyon "attributes didn't match" hatası verirdi ve bunu
 * susturmanın tek yolu tüm `<html>` için `suppressHydrationWarning` olurdu.
 * Sonradan `<head>`e eklenen `<style>` React'in hidrate ettiği ağacın parçası
 * değildir, bu yüzden çakışma yaratmaz.
 */
export function announcementDismissScript(): string {
  const key = JSON.stringify(ANNOUNCEMENT_STORAGE_KEY);
  const id = JSON.stringify(landingAnnouncement.id);
  const css = JSON.stringify(
    `[data-slot="${ANNOUNCEMENT_BAR_SLOT}"]{display:none!important}`
  );
  return `(function(){try{if(localStorage.getItem(${key})===${id}){var s=document.createElement("style");s.textContent=${css};document.head.appendChild(s)}}catch(e){}})();`;
}
