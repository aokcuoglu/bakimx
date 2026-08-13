/**
 * RFC 4180 CSV üretir. `delimiter` varsayılan olarak virgüldür; Türkçe Excel'de
 * çift tıklamayla açılacak dosyalar (katalog içe aktarım şablonu, BAK-34)
 * noktalı virgül ister. Kaçırma kuralı ayraçla birlikte değişir — aksi hâlde
 * `;` ayraçlı bir dosyada içinde noktalı virgül geçen alan tırnaklanmaz ve
 * kolonlar kayar.
 */
export function generateCSV(
  headers: string[],
  rows: (string | number | null)[][],
  delimiter: string = ",",
): string {
  const escapeField = (value: string | number | null): string => {
    if (value === null || value === undefined) return ""
    const str = String(value)
    if (str.includes(delimiter) || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const headerLine = headers.map(escapeField).join(delimiter)
  const dataLines = rows.map((row) => row.map(escapeField).join(delimiter))
  return [headerLine, ...dataLines].join("\n")
}

export function downloadCSV(csvContent: string, filename: string) {
  const BOM = "\uFEFF"
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function printCurrentView() {
  window.print()
}