/**
 * Kaynak tarayan kapılar (`*.test.ts`) için paylaşılan yorum silici (#941).
 *
 * Ham kaynağa uygulanan `/\/\*[\s\S]*?\*\//` bir dizedeki `/*` (`accept="image/*"`,
 * glob, düzenli ifade) yorum başlangıcı sanır ve bir sonraki `*\/`'a kadar her şeyi
 * taramadan düşürür — oradaki ihlal sessizce geçer. Bu yardımcı tek geçişlidir:
 * dize, şablon dizesi ve düzenli ifade olduğu gibi kopyalanır.
 *
 * Sınır: JS/TS/TSX söz dizimi içindir (CSS için değil). `${…}` içindeki yorumlar
 * şablonun parçası sayılır, ayıklanmaz.
 */

/** `quoteIndex`'teki tırnakla açılan dizenin kapanışından sonraki indeksi verir. */
export function skipString(source: string, quoteIndex: number): number {
  const quote = source[quoteIndex]
  for (let i = quoteIndex + 1; i < source.length; i++) {
    const ch = source[i]
    if (ch === "\\") i++
    else if (ch === quote || ch === "\n") return i + 1
  }
  return source.length
}

/** `tickIndex`'teki şablon dizesinin (iç içe `${…}` dahil) kapanışından sonraki indeksi verir. */
export function skipTemplate(source: string, tickIndex: number): number {
  let i = tickIndex + 1
  while (i < source.length) {
    const ch = source[i]
    if (ch === "\\") {
      i += 2
    } else if (ch === "`") {
      return i + 1
    } else if (ch === "$" && source[i + 1] === "{") {
      i += 2
      let depth = 1
      while (i < source.length && depth > 0) {
        const inner = source[i]
        if (inner === '"' || inner === "'") i = skipString(source, i)
        else if (inner === "`") i = skipTemplate(source, i)
        else {
          if (inner === "{") depth++
          else if (inner === "}") depth--
          i++
        }
      }
    } else {
      i++
    }
  }
  return source.length
}


/** Bu karakterlerden sonra gelen `/` bölme değil, düzenli ifade başlangıcıdır. */
const REGEX_AFTER_CHAR = new Set([..."(,=:[!&|?{};+-*%>~^"])
/** Bu anahtar sözcüklerden sonra gelen `/` düzenli ifade başlangıcıdır. */
const REGEX_AFTER_WORD = new Set(["return", "typeof", "case", "void", "delete", "throw", "in", "of", "new", "yield", "await", "else", "do"])

/** `prev` indeksindeki son anlamlı karakterden sonra gelen `/` bir düzenli ifade açar mı? */
function startsRegex(source: string, prev: number): boolean {
  if (prev < 0) return true
  const ch = source[prev]
  if (REGEX_AFTER_CHAR.has(ch)) return true
  if (!/[\w$]/.test(ch)) return false
  let start = prev
  while (start > 0 && /[\w$]/.test(source[start - 1])) start--
  return REGEX_AFTER_WORD.has(source.slice(start, prev + 1))
}

/** `slashIndex`'teki düzenli ifadenin (karakter sınıfı ve kaçış dahil) kapanışından sonraki indeksi verir. */
function skipRegex(source: string, slashIndex: number): number {
  let inClass = false
  for (let i = slashIndex + 1; i < source.length; i++) {
    const ch = source[i]
    if (ch === "\\") i++
    else if (ch === "\n") return i
    else if (inClass) inClass = ch !== "]"
    else if (ch === "[") inClass = true
    else if (ch === "/") return i + 1
  }
  return source.length
}

/**
 * Yorumları aynı uzunlukta boşlukla değiştirir; satır numaraları korunur. Tek
 * geçiştir: dize, şablon dizesi ve düzenli ifade olduğu gibi kopyalanır, yani
 * içlerindeki `/*` ya da `//` yorum sayılmaz.
 */
export function stripComments(source: string): string {
  const parts: string[] = []
  const special = /["'`/]/g
  let prev = -1
  let i = 0
  while (i < source.length) {
    special.lastIndex = i
    const found = special.exec(source)
    const at = found ? found.index : source.length
    if (at > i) {
      parts.push(source.slice(i, at))
      let last = at - 1
      while (last >= i && /\s/.test(source[last])) last--
      if (last >= i) prev = last
    }
    if (!found) break

    const ch = source[at]
    const next = source[at + 1]
    let stop: number
    if (ch === "/" && (next === "/" || next === "*")) {
      const close = next === "/" ? source.indexOf("\n", at) : source.indexOf("*/", at + 2)
      stop = close === -1 ? source.length : next === "/" ? close : close + 2
      parts.push(source.slice(at, stop).replace(/[^\n]/g, " "))
      i = stop
      continue
    }
    if (ch === '"' || ch === "'") stop = skipString(source, at)
    else if (ch === "`") stop = skipTemplate(source, at)
    else if (startsRegex(source, prev)) stop = skipRegex(source, at)
    else stop = at + 1
    parts.push(source.slice(at, stop))
    prev = stop - 1
    i = stop
  }
  return parts.join("")
}
