import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  ANNOUNCEMENT_BAR_SLOT,
  ANNOUNCEMENT_STORAGE_KEY,
  announcementDismissScript,
  landingAnnouncement,
} from "./announcement";

const read = (file: string) =>
  readFileSync(new URL(file, import.meta.url), "utf8");

describe("landing duyuru barı", () => {
  test("duyuru içeriği eksiksiz ve tıklanabilir", () => {
    expect(landingAnnouncement.id).not.toBe("");
    expect(landingAnnouncement.badge).not.toBe("");
    expect(landingAnnouncement.text).not.toBe("");
    expect(landingAnnouncement.linkLabel).not.toBe("");
    expect(landingAnnouncement.href).toMatch(/^\//);
  });

  test("kapatma script'i anahtarı, sürümü ve gizleme kuralını taşır", () => {
    const script = announcementDismissScript();

    expect(script).toContain(JSON.stringify(ANNOUNCEMENT_STORAGE_KEY));
    expect(script).toContain(JSON.stringify(landingAnnouncement.id));
    expect(script).toContain(`[data-slot=\\"${ANNOUNCEMENT_BAR_SLOT}\\"]`);
    expect(script).toContain("display:none");
    // localStorage kapalıysa (gizli sekme, 3rd-party engeli) sayfa patlamamalı.
    expect(script).toContain("catch");
  });

  test("gizleme <html> sınıfıyla değil, enjekte edilen stille yapılır", () => {
    // `<html>`in className'ini React render ediyor; script onu değiştirirse
    // hidrasyon "attributes didn't match" hatası verir (BAK-79 QA'sında görüldü).
    const script = announcementDismissScript();

    expect(script).not.toContain("documentElement");
    expect(script).not.toContain("classList");
    expect(script).toContain("document.head.appendChild");
  });

  test("duyuru metni bileşende değil veri dosyasında yaşıyor", () => {
    const component = read("../../components/sections/AnnouncementBar.tsx");

    expect(component).toContain("landingAnnouncement");
    expect(component).not.toContain(landingAnnouncement.text);
    expect(component).not.toContain(landingAnnouncement.linkLabel);
  });

  test("kapatma script'i client bileşende değil kök layout'ta çalışır", () => {
    const component = read("../../components/sections/AnnouncementBar.tsx");
    const layout = read("../../app/layout.tsx");
    const publicScript = read(
      "../../../public/landing/announcement-dismiss.js",
    ).trim();

    expect(component).not.toContain("<script");
    expect(component).not.toContain("announcementDismissScript");
    expect(layout).toContain('import Script from "next/script"');
    expect(layout).toContain('strategy="beforeInteractive"');
    expect(layout).toContain('src="/landing/announcement-dismiss.js"');
    expect(publicScript).toBe(announcementDismissScript());
    expect(layout.indexOf("<Script")).toBeGreaterThan(layout.indexOf("<body"));
    expect(layout.indexOf("<Script")).toBeLessThan(layout.indexOf("</body>"));
  });
});
