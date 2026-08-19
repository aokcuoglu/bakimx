import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  getAssistantBridge,
  getServerAssistantBridge,
  requestAssistantAnswers,
  requestLiveChatResume,
  resetAssistantBridge,
  setAskBarVisible,
  setAssistantPanelOpen,
  subscribeAssistantBridge,
} from "./assistant-bridge";

const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");

afterEach(() => {
  resetAssistantBridge();
});

describe("asistan köprüsü", () => {
  test("ask bar sorusu abonelere ulaşır", () => {
    let notified = 0;
    subscribeAssistantBridge(() => notified++);

    requestAssistantAnswers("dışarıdan parça takibi");

    expect(notified).toBe(1);
    expect(getAssistantBridge().request?.query).toBe("dışarıdan parça takibi");
  });

  test("aynı soru ikinci kez sorulduğunda da paneli açar", () => {
    requestAssistantAnswers("stok takibi");
    const first = getAssistantBridge().request!.nonce;

    requestAssistantAnswers("stok takibi");
    const second = getAssistantBridge().request!.nonce;

    // Yalnız `query` karşılaştırılsaydı ikinci tıklama sessizce yutulurdu.
    expect(second).toBeGreaterThan(first);
  });

  test("boş soru gönderilmez", () => {
    let notified = 0;
    subscribeAssistantBridge(() => notified++);

    requestAssistantAnswers("   ");

    expect(notified).toBe(0);
    expect(getAssistantBridge().request).toBeNull();
  });

  test("soru kırpılarak taşınır", () => {
    requestAssistantAnswers("  hasar kanıtı  ");

    expect(getAssistantBridge().request?.query).toBe("hasar kanıtı");
  });

  test("değişmeyen değer aboneleri uyandırmaz", () => {
    let notified = 0;
    subscribeAssistantBridge(() => notified++);

    setAskBarVisible(false);
    setAssistantPanelOpen(false);

    expect(notified).toBe(0);

    setAskBarVisible(true);
    setAskBarVisible(true);

    expect(notified).toBe(1);
  });

  test("anlık görüntü referansı değişmediğinde sabit kalır", () => {
    // `useSyncExternalStore` her render'da bunu çağırır; aynı durumda farklı
    // bir nesne dönmek sonsuz render döngüsü demektir.
    const before = getAssistantBridge();
    setAskBarVisible(false);

    expect(getAssistantBridge()).toBe(before);
  });

  test("abonelikten çıkılınca bildirim kesilir", () => {
    let notified = 0;
    const unsubscribe = subscribeAssistantBridge(() => notified++);

    setAskBarVisible(true);
    unsubscribe();
    setAskBarVisible(false);

    expect(notified).toBe(1);
  });

  test("sunucu anlık görüntüsü her zaman boş başlangıç durumu", () => {
    requestAssistantAnswers("stok");
    setAskBarVisible(true);
    setAssistantPanelOpen(true);

    // Store modül seviyesinde yaşıyor; sunucu render'ı bir önceki isteğin
    // durumunu görürse hidrasyon uyuşmazlığı çıkar.
    expect(getServerAssistantBridge()).toEqual({
      request: null,
      askBarVisible: false,
      panelOpen: false,
      resumeNonce: 0,
    });
  });
});

describe("canlı destek devam isteği (BAK-99)", () => {
  test("her istek sayacı artırır — aynı bağlantı iki kez açılsa da panel açılır", () => {
    expect(getAssistantBridge().resumeNonce).toBe(0);
    requestLiveChatResume();
    expect(getAssistantBridge().resumeNonce).toBe(1);
    requestLiveChatResume();
    expect(getAssistantBridge().resumeNonce).toBe(2);
  });

  test("aboneler haberdar edilir", () => {
    let notified = 0;
    const unsubscribe = subscribeAssistantBridge(() => notified++);
    requestLiveChatResume();
    unsubscribe();
    expect(notified).toBe(1);
  });
});

describe("geçici açılış kalıcı durumu bozmaz", () => {
  test("ask bar açılışında localStorage'a 'açık' yazılmaz", () => {
    // Kabul kriteri: bir soru sormak "asistanı kalıcı olarak açık bırak"
    // demek değil. Kaynak taraması, davranışı gözden kaçan bir refactor'da
    // sessizce kaybetmemek için.
    const source = read("./site-assistant.tsx");

    // Geçici açılışın olduğu dal `persist` çağırmamalı.
    const transientBranch = source.match(/if \(!open\) \{[\s\S]*?\}/)?.[0] ?? "";

    expect(transientBranch).toContain("setTransient(true)");
    expect(transientBranch).not.toContain("persist(");
    // Kapanışta da yalnız kalıcı açılışlar yazılır.
    expect(source).toContain("if (!transient) persist(false)");
  });
});
