/** "25 Kasım Çarşamba" biçimi; sunucu saat diliminden bağımsız olarak Türkiye gününü verir. */
export function formatTodayTr(date: Date): string {
  return date.toLocaleDateString("tr-TR", {
    timeZone: "Europe/Istanbul",
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}
