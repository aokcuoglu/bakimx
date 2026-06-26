export function buildModelQuery(params: { brandId: number; q?: string; limit?: number }) {
  const q = (params.q ?? "").trim()
  const take = Math.min(Math.max(params.limit ?? 100, 1), 200)
  const where: { brandId: number; name?: { contains: string; mode: "insensitive" } } = {
    brandId: params.brandId,
  }
  if (q) where.name = { contains: q, mode: "insensitive" }
  return { where, select: { id: true as const, name: true as const }, take, orderBy: { name: "asc" as const } }
}
