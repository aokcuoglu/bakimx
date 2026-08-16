/**
 * Hero'daki ask bar ile asistan arasındaki ince köprü (BAK-81).
 *
 * Neden bir store: `SiteAssistant` kök `layout.tsx`te, ask bar ise `/`
 * sayfasının hero'sunda duruyor. İkisinin ortak bir React ebeveyni yok; layout'u
 * bir context sağlayıcıyla sarmak `{children}` ağacının tamamını gereksizce
 * istemci sınırına yaklaştırırdı. `useSyncExternalStore` deseni bu depoda zaten
 * kullanılıyor (bkz. `FAQSection`in hash aboneliği).
 *
 * Akış tek yönlü değil, iki uçlu ve küçük:
 *   ask bar → asistan : `requestAssistantAnswers(query)`
 *   ask bar → launcher: `setAskBarVisible(...)`  (FAB ile ask bar aynı anda durmaz)
 *   asistan → ask bar : `setAssistantPanelOpen(...)` (`aria-expanded` için)
 */

export type AssistantRequest = {
  query: string;
  /**
   * Aynı soru iki kez sorulduğunda da paneli yeniden açabilmek için artan
   * sayaç. Yalnız `query` karşılaştırmak ikinci tıklamayı sessizce yutardı.
   */
  nonce: number;
};

export type AssistantBridgeState = {
  request: AssistantRequest | null;
  /** Hero'daki ask bar şu an ekranda mı? */
  askBarVisible: boolean;
  /** Asistan paneli açık mı? */
  panelOpen: boolean;
};

const INITIAL: AssistantBridgeState = Object.freeze({
  request: null,
  askBarVisible: false,
  panelOpen: false,
});

let state: AssistantBridgeState = INITIAL;
let nonce = 0;

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

/** Ask bar'dan gelen soru — asistan bunu görüp cevap görünümünü açar. */
export function requestAssistantAnswers(query: string): void {
  const trimmed = query.trim();
  if (trimmed.length === 0) return;
  nonce += 1;
  emit({ ...state, request: { query: trimmed, nonce } });
}

export function setAskBarVisible(visible: boolean): void {
  if (state.askBarVisible === visible) return;
  emit({ ...state, askBarVisible: visible });
}

export function setAssistantPanelOpen(open: boolean): void {
  if (state.panelOpen === open) return;
  emit({ ...state, panelOpen: open });
}

/** Yalnız testler için: modül seviyesindeki durumu başa alır. */
export function resetAssistantBridge(): void {
  state = INITIAL;
  nonce = 0;
  listeners.clear();
}
