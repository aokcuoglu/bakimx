/**
 * Asistanı kök `layout.tsx`teki `SiteAssistant`e dışarıdan uyandıran ince
 * köprü (BAK-81, BAK-99).
 *
 * Neden bir store: `SiteAssistant` kök `layout.tsx`te, tetikleyen sayfalar ise
 * ağacın başka yerinde. Ortak bir React ebeveyni yok; layout'u bir context
 * sağlayıcıyla sarmak `{children}` ağacının tamamını gereksizce istemci
 * sınırına yaklaştırırdı. `useSyncExternalStore` deseni bu depoda zaten
 * kullanılıyor (bkz. `FAQSection`in hash aboneliği).
 */

export type AssistantBridgeState = {
  /**
   * `/destek/<token>` sayfası paneli canlı destek görünümünde açmak istiyor
   * (BAK-99). Aynı sayfaya iki kez girilse de açılabilsin diye yine sayaç.
   */
  resumeNonce: number;
};

const INITIAL: AssistantBridgeState = Object.freeze({
  resumeNonce: 0,
});

let state: AssistantBridgeState = INITIAL;
let resumeNonce = 0;

const listeners = new Set<() => void>();

function emit(next: AssistantBridgeState): void {
  if (next === state) return;
  state = next;
  for (const listener of listeners) listener();
}

export function subscribeAssistantBridge(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAssistantBridge(): AssistantBridgeState {
  return state;
}

/**
 * Sunucu render'ı her zaman başlangıç durumunu görür. Store modül seviyesinde
 * yaşadığı için bu şart: aksi halde bir isteğin bıraktığı durum sonraki
 * render'a sızar ve hidrasyon uyuşmazlığı yaratırdı.
 */
export function getServerAssistantBridge(): AssistantBridgeState {
  return INITIAL;
}

/**
 * E-postadaki bağlantıdan gelindi: paneli doğrudan sohbet görünümünde aç.
 * Görüşme anahtarını çağıran `localStorage`a ÖNCEDEN yazmış olmalı — panel
 * açılır açılmaz onu okuyup geçmişi çeker.
 */
export function requestLiveChatResume(): void {
  resumeNonce += 1;
  emit({ ...state, resumeNonce });
}

/** Yalnız testler için: modül seviyesindeki durumu başa alır. */
export function resetAssistantBridge(): void {
  state = INITIAL;
  resumeNonce = 0;
  listeners.clear();
}
