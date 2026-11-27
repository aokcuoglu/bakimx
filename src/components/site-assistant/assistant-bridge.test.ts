import { afterEach, describe, expect, test } from "bun:test";

import {
  getAssistantBridge,
  getServerAssistantBridge,
  requestLiveChatResume,
  resetAssistantBridge,
  subscribeAssistantBridge,
} from "./assistant-bridge";

afterEach(() => {
  resetAssistantBridge();
});

describe("asistan köprüsü", () => {
  test("anlık görüntü referansı değişmediğinde sabit kalır", () => {
    // `useSyncExternalStore` her render'da bunu çağırır; aynı durumda farklı
    // bir nesne dönmek sonsuz render döngüsü demektir.
    const before = getAssistantBridge();
    expect(getAssistantBridge()).toBe(before);
  });

  test("sunucu anlık görüntüsü her zaman boş başlangıç durumu", () => {
    requestLiveChatResume();

    // Store modül seviyesinde yaşıyor; sunucu render'ı bir önceki isteğin
    // durumunu görürse hidrasyon uyuşmazlığı çıkar.
    expect(getServerAssistantBridge()).toEqual({ resumeNonce: 0 });
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
