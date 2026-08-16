import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  MAX_ASSISTANT_ANSWERS,
  matchAssistantAnswers,
  normalizeText,
  sharesStem,
  tokenize,
} from "./assistant-answers";
import { LANDING_OBJECTIONS } from "./objections";

const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");

describe("metin normalizasyonu", () => {
  test("Türkçe büyük harf küçültmesi doğru kökü verir", () => {
    // Varsayılan `toLowerCase` "I" harfini "i" yapar; "IŞIK" o zaman "isik"
    // yerine yanlış bir köke bağlanırdı.
    expect(normalizeText("IŞIK")).toBe("isik");
    expect(normalizeText("İŞ EMRİ")).toBe("is emri");
    expect(normalizeText("Parça, Şasi & Ruhsat!")).toBe("parca sasi ruhsat");
  });

  test("noktalama ve fazla boşluk temizlenir", () => {
    expect(normalizeText("  stok  --  düşümü??  ")).toBe("stok dusumu");
  });

  test("anlamsız kelimeler ve tekrarlar elenir", () => {
    // "nasıl", "olur", "bir" ayırt edici değil; "parça" iki kez sayılmaz.
    expect(tokenize("Parça takibi nasıl olur, bir parça daha?")).toEqual([
      "parca",
      "takibi",
    ]);
    expect(tokenize("ne için mi")).toEqual([]);
  });
});

describe("kök eşleştirme", () => {
  test("Türkçe ekler kökü bozmaz", () => {
    expect(sharesStem("parca", "parcayi")).toBe(true);
    expect(sharesStem("hasar", "hasarli")).toBe(true);
    expect(sharesStem("fiyat", "fiyatlarini")).toBe(true);
  });

  test("ünsüz yumuşaması eşleşmeyi kırmaz", () => {
    // "stok" → "stoğum": k harfi ğ'ye dönüşür, normalize sonrası g olur.
    expect(sharesStem("stok", "stogum")).toBe(true);
    expect(sharesStem("kitap", "kitabi")).toBe(true);
  });

  test("benzer görünen farklı kelimeler eşleşmez", () => {
    expect(sharesStem("parca", "para")).toBe(false);
    expect(sharesStem("kabul", "kabin")).toBe(false);
    // Üç harfli kelimeler kök sayılamayacak kadar kısa.
    expect(sharesStem("vin", "vinc")).toBe(false);
  });
});

describe("hazır cevap eşleştirme", () => {
  test("issue'daki örnek soru kendi itirazını bulur", () => {
    const answers = matchAssistantAnswers("dışarıdan parça takibi nasıl olur?");

    expect(answers.length).toBeGreaterThan(0);
    expect(answers[0].id).toBe("dis-alim-parca");
    expect(answers[0].source).toBe("objection");
  });

  test("kartların kendi soruları her zaman kendi cevabını getirir", () => {
    // Çipler ve itiraz kartları bu soruları birebir gönderiyor; biri bile
    // eşleşmezse ask bar kendi hazır sorusuna "yanıtımız yok" derdi.
    for (const objection of LANDING_OBJECTIONS) {
      const answers = matchAssistantAnswers(objection.question);
      expect(answers.map((a) => a.id)).toContain(objection.id);
    }
  });

  test("anahtar kelimeler soruda geçmeyen karşılıkları da yakalar", () => {
    // "wp" ve "çizik" hiçbir soru/cevap cümlesinde geçmiyor; yalnız keywords'te.
    expect(matchAssistantAnswers("wp ile durum bilgisi").map((a) => a.id)).toContain(
      "musteri-arayisi",
    );
    expect(matchAssistantAnswers("çizik tartışması").map((a) => a.id)).toContain(
      "hasar-kanit",
    );
  });

  test("SSS maddeleri de eşleşme havuzunda", () => {
    const answers = matchAssistantAnswers("mobilde çalışır mı");

    expect(answers.length).toBeGreaterThan(0);
    expect(answers.some((a) => a.source === "faq")).toBe(true);
  });

  test("eşleşme yoksa boş döner — uydurma cevap yok", () => {
    // Boş dizi panelde canlı destek / demo düşüşünü tetikler.
    expect(matchAssistantAnswers("asdf qwer zxcv")).toEqual([]);
    expect(matchAssistantAnswers("bugün hava çok güzel")).toEqual([]);
    expect(matchAssistantAnswers("   ")).toEqual([]);
    expect(matchAssistantAnswers("")).toEqual([]);
  });

  test("en fazla üç cevap döner ve sonuç kararlıdır", () => {
    const query = "parça fiyatı ve stok takibi";
    const first = matchAssistantAnswers(query);
    const second = matchAssistantAnswers(query);

    expect(first.length).toBeLessThanOrEqual(MAX_ASSISTANT_ANSWERS);
    expect(first).toEqual(second);
  });

  test("tek kelimelik alakasız girdi tek cevap gövdesine takılmaz", () => {
    // "hesabınızı" gibi bir kelime yalnız cevap metninde geçiyorsa (1 puan)
    // eşik altındadır; ilgisiz bir madde listelenmemeli.
    for (const answer of matchAssistantAnswers("bilgisayar")) {
      expect(answer.source).toBe("faq");
    }
  });

  test("itirazlar eşit puanda SSS'ten önce gelir", () => {
    const answers = matchAssistantAnswers("stok takibi");
    const objectionIndex = answers.findIndex((a) => a.id === "stok-dusumu");

    expect(objectionIndex).toBe(0);
  });
});

describe("itiraz anahtar kelimeleri", () => {
  test("her itirazın eşleştirmeye giren anahtar kelimesi var", () => {
    for (const objection of LANDING_OBJECTIONS) {
      expect(objection.keywords.length).toBeGreaterThanOrEqual(4);
      // Filtreden geçmeyen (çok kısa ya da stopword) kelime sessizce ölür.
      expect(tokenize(objection.keywords.join(" ")).length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("ask bar tek kaynağa bağlı", () => {
  test("çip metinleri bileşende değil objections.ts'te", () => {
    const askBar = read("../../components/sections/HeroAskBar.tsx");

    expect(askBar).toContain("LANDING_OBJECTIONS");
    for (const objection of LANDING_OBJECTIONS) {
      expect(askBar).not.toContain(objection.question);
    }
  });

  test("placeholder yapmadığımız bir şeyi vaat etmiyor", () => {
    // Yaklaşım A hazır cevap eşleştirir; "her şeyi sorun" bir AI vaadidir.
    const askBar = read("../../components/sections/HeroAskBar.tsx");
    const placeholder = askBar.match(/placeholder="([^"]+)"/)?.[1] ?? "";

    expect(placeholder.length).toBeGreaterThan(0);
    expect(normalizeText(placeholder)).not.toContain("her seyi");
  });

  test("hero akış içinde kalır — sticky/fixed CTA eklenmedi", () => {
    // Kaldırılmış bir konvansiyon: dipte sabitlenen aksiyon barı yok.
    const askBar = read("../../components/sections/HeroAskBar.tsx");

    expect(askBar).not.toMatch(/\b(?:fixed|sticky)\s+(?:inset-x-0\s+)?bottom-/);
  });
});
