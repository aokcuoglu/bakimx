/**
 * Ask bar'a yazılan serbest metni HAZIR cevaplarla eşleştirir (BAK-81, yaklaşım A).
 *
 * Burada model yok, uç nokta yok, üretilmiş cümle yok: yalnız `objections.ts` ve
 * `faq-data.ts` içindeki mevcut metinler puanlanır ve en yakın 2–3 tanesi
 * döndürülür. Eşleşme yoksa boş dizi döner ve panel canlı destek / demo akışına
 * düşer. Bu bilinçli bir sınır — uydurulmuş cevap riskini sıfırda tutar.
 *
 * Gerçek AI yanıtı (yaklaşım B) ayrı bir issue'nun ve bayrağın konusudur.
 */
import { FAQ_ITEMS } from "@/lib/faq-data";
import { LANDING_OBJECTIONS } from "./objections";

export type AssistantAnswerSource = "objection" | "faq";

export type AssistantAnswer = {
  id: string;
  source: AssistantAnswerSource;
  question: string;
  answer: string;
  /** Yalnız itirazlarda var: SSS'teki tam maddeye giden derin link. */
  href?: string;
};

/**
 * Türkçe harfleri ASCII'ye indirger; "parça" ile "parca" aynı yazım sayılsın.
 * `toLocaleLowerCase("tr")` şart — varsayılan küçültme "I" harfini "i" yapıp
 * "IŞIK" gibi girdileri yanlış köke bağlardı.
 */
const FOLD: Record<string, string> = {
  ı: "i",
  ğ: "g",
  ü: "u",
  ş: "s",
  ö: "o",
  ç: "c",
  â: "a",
  î: "i",
  û: "u",
};

export function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/[ığüşöçâîû]/g, (ch) => FOLD[ch] ?? ch)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Tek başına ayırt edici olmayan kelimeler. Normalize edilmiş hâlleriyle
 * tutulur ki listeyi yazarken Türkçe karakter kaçırmak sessiz bir hataya
 * dönüşmesin.
 */
const STOPWORDS = new Set(
  [
    "acaba", "ama", "ancak", "bana", "bende", "beni", "benim", "bir", "biz", "bize", "bu",
    "buna", "bunu", "çok", "da", "daha", "de", "değil", "diye", "edebilir", "ederim",
    "eder", "en", "gibi", "hem", "her", "hiç", "için", "ile", "ise", "kadar", "ki", "mi",
    "mı", "mu", "mü", "musunuz", "mısınız", "nasıl", "ne", "neden", "nedir", "olan",
    "olarak", "olur", "onu", "oluyor", "sonra", "şey", "siz", "sizin", "şu", "var",
    "vardır", "veya", "yok", "yani", "ya", "yapabilir", "yapılır", "ben",
  ].map(normalizeText),
);

/** Bu uzunluğun altındaki ortak önek kök sayılmaz. */
const MIN_STEM = 4;

/**
 * Türkçe ünsüz yumuşaması: "stok" → "stoğum" (k→ğ→g), "kitap" → "kitabı".
 * Kök karşılaştırırken bu çiftleri aynı harf sayarız, yoksa ek almış hâli
 * kendi köküyle eşleşmezdi.
 */
const SOFT: Record<string, string> = { g: "k", b: "p", d: "t" };
const soften = (ch: string) => SOFT[ch] ?? ch;

/**
 * İki kelime aynı kökten mi? Türkçe eklerin tamamı sona geldiği için ortak
 * önek uzunluğuna bakmak, ek listesi tutmadan makul bir yaklaşım verir.
 * "parça"/"parçayı" eşleşir, "parça"/"para" eşleşmez.
 */
export function sharesStem(a: string, b: string): boolean {
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.length < MIN_STEM) return false;

  let common = 0;
  while (common < shorter.length && soften(shorter[common]) === soften(longer[common])) {
    common++;
  }
  // Kısa kelimenin neredeyse tamamı ortak olmalı; "stok"/"stoklarim" evet,
  // "kabul"/"kabin" hayır.
  return common >= MIN_STEM && common >= shorter.length - 2;
}

export function tokenize(value: string): string[] {
  const seen = new Set<string>();
  for (const token of normalizeText(value).split(" ")) {
    if (token.length >= 3 && !STOPWORDS.has(token)) seen.add(token);
  }
  return [...seen];
}

/** Anahtar kelime > soru > cevap: eşleşmenin nerede olduğu güveni belirler. */
const WEIGHT = { keyword: 3, question: 2, answer: 1 } as const;

type CorpusEntry = AssistantAnswer & {
  keywordTokens: string[];
  questionTokens: string[];
  answerTokens: string[];
};

const CORPUS: CorpusEntry[] = [
  ...LANDING_OBJECTIONS.map((objection) => ({
    id: objection.id,
    source: "objection" as const,
    question: objection.question,
    answer: objection.answer,
    href: objection.href,
    keywordTokens: tokenize(objection.keywords.join(" ")),
    questionTokens: tokenize(objection.question),
    answerTokens: tokenize(objection.answer),
  })),
  ...FAQ_ITEMS.map((faq, index) => ({
    id: `faq-${index}`,
    source: "faq" as const,
    question: faq.question,
    answer: faq.answer,
    keywordTokens: [],
    questionTokens: tokenize(faq.question),
    answerTokens: tokenize(faq.answer),
  })),
];

function tokenScore(token: string, entry: CorpusEntry): number {
  if (entry.keywordTokens.some((k) => sharesStem(token, k))) return WEIGHT.keyword;
  if (entry.questionTokens.some((q) => sharesStem(token, q))) return WEIGHT.question;
  if (entry.answerTokens.some((a) => sharesStem(token, a))) return WEIGHT.answer;
  return 0;
}

/**
 * En az bu kadar puan: tek bir cevap-gövdesi denk gelmesi (1 puan) yeterli
 * değil, sorunun kendisine ya da anahtar kelimeye dokunmuş olmalı.
 */
const MIN_SCORE = 2;

export const MAX_ASSISTANT_ANSWERS = 3;

/**
 * Serbest metni hazır cevaplarla eşleştirir.
 *
 * Boş dizi "cevabımız yok" demektir ve panelde canlı destek / demo akışına
 * düşmeyi tetikler — asla uydurma bir cevaba düşmez.
 */
export function matchAssistantAnswers(
  query: string,
  limit: number = MAX_ASSISTANT_ANSWERS,
): AssistantAnswer[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  // Tek kelimelik soruda o kelime, uzun soruda en az iki kelime tutmalı;
  // aksi halde rastgele bir kelimeye takılan alakasız cevap listelenirdi.
  const requiredMatches = Math.min(2, tokens.length);

  return CORPUS.map((entry, index) => {
    let score = 0;
    let matched = 0;
    for (const token of tokens) {
      const value = tokenScore(token, entry);
      if (value > 0) {
        score += value;
        matched++;
      }
    }
    return { entry, index, score, matched };
  })
    .filter(({ score, matched }) => matched >= requiredMatches && score >= MIN_SCORE)
    // Eşit puanda dizilim sırası korunur: itirazlar SSS'ten önce gelir ve
    // sonuç her çağrıda aynı olur.
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ entry }) => ({
      id: entry.id,
      source: entry.source,
      question: entry.question,
      answer: entry.answer,
      href: entry.href,
    }));
}
