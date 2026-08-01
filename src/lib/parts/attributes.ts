/**
 * Atölye geçmişi ve katalogdan gelen parça niteliklerini kullanıcıya gösterilecek
 * tek bir listeye dönüştürür. İlk kaynağın yazımı korunur; boş ve Türkçe
 * case-insensitive tekrarlar elenir.
 */
export function mergePartAttributeOptions(...sources: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>()
  const options: string[] = []

  for (const source of sources) {
    for (const rawValue of source) {
      const value = rawValue.trim()
      const key = value.toLocaleLowerCase("tr")
      if (!value || seen.has(key)) continue

      seen.add(key)
      options.push(value)
    }
  }

  return options
}
