export function formatBlogDate(iso: string, locale = "tr-TR"): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso))
}
