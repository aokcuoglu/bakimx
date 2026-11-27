import { formatTrLongDate } from "@/lib/format-date"

export function formatBlogDate(iso: string): string {
  return formatTrLongDate(iso)
}
