export function computeDashboardPage<T>(items: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const start = currentPage * pageSize
  const pageItems = items.slice(start, start + pageSize)
  return { page: currentPage, pageCount, pageItems }
}
