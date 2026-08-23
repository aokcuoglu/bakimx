import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"
import { requireWritableWorkshop } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { resolveFeature } from "@/lib/features"
import { type PlanTier } from "@/lib/plan"
import { rateLimit } from "@/lib/rate-limit"
import { searchVehicleArticles } from "@/lib/tecdoc/catalog"
import { searchBakimxProducts } from "@/lib/parts/bakimx-catalog"
import { searchGetirbakimProducts } from "@/lib/parts/getirbakim/search"
import { aiPartSearchAllowedRole, mockAiPartSearchQuery, normalizeAiSearchQuery, type AiPartSuggestion } from "@/lib/parts/ai-search"

const MAX_RESULTS_PER_SOURCE = 5

async function resolveQuery(message: string): Promise<{ query: string; provider: "mock" | "anthropic" }> {
  if ((process.env.AI_PROVIDER || "mock").toLowerCase() === "mock") {
    return { query: mockAiPartSearchQuery(message), provider: "mock" }
  }
  if ((process.env.AI_PROVIDER || "").toLowerCase() !== "anthropic" || !process.env.ANTHROPIC_API_KEY) {
    throw new Error("AI parça araması için AI_PROVIDER=anthropic ve ANTHROPIC_API_KEY gereklidir.")
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: process.env.AI_MODEL || "claude-haiku-4-5",
    max_tokens: 200,
    temperature: 0,
    system: "Oto yedek parça arama asistanısın. Kullanıcının isteğini kısa bir katalog arama sorgusuna çevir ve search_parts aracını çağır.",
    tools: [{ name: "search_parts", description: "Yetkili parça kataloglarında arama yapar", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } }],
    tool_choice: { type: "tool", name: "search_parts" },
    messages: [{ role: "user", content: message }],
  }, { signal: AbortSignal.timeout(8_000) })
  const call = response.content.find((block) => block.type === "tool_use")
  const input = call?.type === "tool_use" ? call.input as { query?: unknown } : {}
  return { query: normalizeAiSearchQuery(input.query, message), provider: "anthropic" }
}

export async function POST(request: Request) {
  try {
    const { user, workshop } = await requireWritableWorkshop("order.edit")
    if (!aiPartSearchAllowedRole(user.role)) return NextResponse.json({ error: "Bu özellik yalnız Yönetici ve Usta rollerine açıktır." }, { status: 403 })
    if (!(await resolveFeature(workshop.id, workshop.planTier as PlanTier, "aiAdvisor"))) return NextResponse.json({ error: "AI parça araması Premium pakete özeldir." }, { status: 403 })
    const limited = await rateLimit(`ai-parts:${user.workshopId}:${user.id}`, 10, 60_000)
    if (!limited.allowed) return NextResponse.json({ error: "Çok fazla arama yaptınız. Lütfen kısa süre sonra tekrar deneyin." }, { status: 429, headers: { "Retry-After": String(Math.ceil(limited.retryAfterMs / 1000)) } })

    const body = await request.json() as { message?: unknown; vehicleTypeId?: unknown }
    if (typeof body.message !== "string" || body.message.trim().length < 2 || body.message.length > 500) return NextResponse.json({ error: "Arama isteği 2-500 karakter olmalıdır." }, { status: 400 })
    const vehicleTypeId = typeof body.vehicleTypeId === "number" && Number.isInteger(body.vehicleTypeId) && body.vehicleTypeId > 0 ? body.vehicleTypeId : null
    const { query, provider } = await resolveQuery(body.message)
    const stockPromise = prisma.partStockItem.findMany({ where: { workshopId: user.workshopId, isActive: true, OR: [{ name: { contains: query, mode: "insensitive" } }, { sku: { contains: query, mode: "insensitive" } }, { oemNo: { contains: query, mode: "insensitive" } }, { brand: { contains: query, mode: "insensitive" } }] }, select: { id: true, name: true, sku: true, brand: true, stockQty: true, unit: true, salePrice: true }, take: MAX_RESULTS_PER_SOURCE })
    const [stock, tecdoc, bakimx, getirbakim] = await Promise.all([
      stockPromise,
      vehicleTypeId ? searchVehicleArticles(vehicleTypeId, query, { limit: MAX_RESULTS_PER_SOURCE }).catch(() => []) : Promise.resolve([]),
      searchBakimxProducts({ q: query, limit: MAX_RESULTS_PER_SOURCE, vehicleTypeId, workshopId: user.workshopId }).catch(() => []),
      searchGetirbakimProducts({ q: query, limit: MAX_RESULTS_PER_SOURCE, vehicleTypeId }).catch(() => []),
    ])
    const suggestions: AiPartSuggestion[] = [
      ...tecdoc.map((a) => ({ key: `t-${a.tecdocArticleId}`, source: "tecdoc" as const, sourceLabel: "TecDoc · araca uygun", name: a.productName, sku: a.articleNo, brand: a.supplierName, stockLabel: null, priceKurus: null, tecdocArticleId: a.tecdocArticleId })),
      ...bakimx.map((p) => ({ key: `b-${p.id}`, source: "bakimx" as const, sourceLabel: "BakımX", name: p.name, sku: p.sku, brand: p.brandName, stockLabel: p.stockQty > 0 ? `Stok: ${p.stockQty} ${p.unit}` : p.backorderable ? "Siparişe açık" : "Stokta yok", priceKurus: p.displayPriceKurus, bakimxProductId: p.id })),
      ...getirbakim.map((p) => ({ key: `g-${p.id}`, source: "getirbakim" as const, sourceLabel: "GetirBakım", name: p.name, sku: p.manufacturerPartNumber?.value || p.partNo, brand: p.brandName, stockLabel: `${p.stockQty} adet · ${p.availability === "IN_STOCK" ? "stokta" : p.availability === "SUPPLYABLE" ? "tedarik edilebilir" : "mevcut değil"}`, priceKurus: p.b2bPriceKurus, getirbakimProductId: p.sourceProductId || p.id })),
      ...stock.map((p) => ({ key: `s-${p.id}`, source: "stock" as const, sourceLabel: "Kendi stoğunuz", name: p.name, sku: p.sku, brand: p.brand, stockLabel: `Stok: ${p.stockQty} ${p.unit}`, priceKurus: p.salePrice, partId: p.id })),
    ]
    return NextResponse.json({ success: true, query, provider, suggestions })
  } catch (error) {
    console.error("[ai-parts]", error)
    return NextResponse.json({ error: "AI parça araması şu anda kullanılamıyor. Normal parça aramasını kullanabilirsiniz." }, { status: 503 })
  }
}
