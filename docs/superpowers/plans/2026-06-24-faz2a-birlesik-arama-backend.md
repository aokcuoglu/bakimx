# Faz 2a: Birleşik Arama Backend (saf mantık + arama API + sahip-değiştir) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tek searchable müşteri+araç picker'ın (Faz 2b) ihtiyaç duyduğu backend'i kurmak: plaka/VIN **veya** ad/telefon ile arayan birleşik bir endpoint, sonuçları etiketleyen **saf** bir fonksiyon (TDD), ve aracın sahibini güncelleyen `changeVehicleOwnerAction`.

**Architecture:** Yeni `GET /api/search/customer-vehicle?q=` hem müşterilerde (mevcut OR araması) hem araçlarda (plaka/VIN contains) `workshopId`-kapsamlı sorgu yapar, sonra **saf** `buildUnifiedResults()` ile birleşik, etiketli liste üretir (bu saf fonksiyon `bun test` ile red-green TDD'lenir). `changeVehicleOwnerAction`, `createVehicleAction`'ın auth+workshop desenini birebir izleyerek `Vehicle.customerId`'yi güvenle günceller. Sıfır şema değişikliği (tüm alanlar mevcut).

**Tech Stack:** Next.js 16 (route handlers + server actions), Prisma 7 (PostgreSQL), TypeScript strict, Bun (`bun test`), Zod.

## Global Constraints

- **Tenant izolasyonu:** her sorgu/aksiyon `workshopId`'yi `requireAuth()`'tan türetir; client parametresine asla güvenilmez.
- **Şema değişikliği YOK** (Faz 2 hiçbir Prisma migrasyonu içermez — plaka/VIN/müşteri alanları ve `Vehicle.customerId` zaten mevcut).
- **TypeScript strict; `any` kullanma** (gerekçesiz). Mevcut `/api/customers` route'undaki `where as any` desenini KOPYALAMA — `Prisma.CustomerWhereInput` / nesne literali kullan.
- **UI metinleri Türkçe.** Plaka büyük harf saklanır; arama `mode: "insensitive"`.
- **Dokunma:** `.env`, prod config, `patches/`.
- **Paket yöneticisi bun.** Komutlar: `bun run typecheck`, `bun run lint`, `bun test`, `bun run build`. **`bun install`/`add`/`update` ÇALIŞTIRMA**; `package.json`/`bun.lock` değiştirme.
- **Commit'ler küçük; branch `feat/unified-work-order-flow` (izole worktree);** her commit mesajı şu satırla biter:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **Çalışma dizini:** worktree `/Users/void/www/bakimx/.claude/worktrees/unified-work-order` (node_modules üst dizinden çözülür).

> **Test stratejisi:** Saf `buildUnifiedResults` mantığı `bun test` ile gerçek red-green TDD edilir (Task 1). API route + server action için entegrasyon harness'i yoktur (yerel DB yok, Docker yasak) → `bun run typecheck` + `bun run lint` + `bun run build` ile doğrulanır; canlı DB/curl QA kullanıcıya ertelenir.

---

### Task 1: `buildUnifiedResults` saf mantık + tipler (TDD)

Müşteri+araç DB satırlarını tek, etiketli sonuç listesine çeviren saf fonksiyon. Gerçek red-green TDD.

**Files:**
- Create: `src/lib/search/unified-results.ts`
- Test: `src/lib/search/unified-results.test.ts`

**Interfaces:**
- Consumes: yok.
- Produces:
  - `type CustomerLite = { id: string; firstName: string | null; lastName: string | null; fullName: string | null; companyName: string | null; type: string; phone: string }`
  - `type VehicleLite = { id: string; plate: string; brand: string; model: string; customerId: string; customer: CustomerLite | null }`
  - `type UnifiedResult = { kind: "vehicle"; vehicleId: string; customerId: string; plate: string; label: string; sublabel: string } | { kind: "customer"; customerId: string; label: string; sublabel: string }`
  - `displayCustomerName(c: CustomerLite | null | undefined): string`
  - `buildUnifiedResults(input: { customers: CustomerLite[]; vehicles: VehicleLite[] }): UnifiedResult[]`
  - Task 2 (API) tüketir.

- [ ] **Step 1: Failing test yaz**

`src/lib/search/unified-results.test.ts`:

```ts
import { expect, test } from "bun:test"
import { buildUnifiedResults, displayCustomerName } from "@/lib/search/unified-results"

const indiv = { id: "c1", firstName: "Ahmet", lastName: "Yılmaz", fullName: null, companyName: null, type: "individual", phone: "05321112233" }
const corp = { id: "c2", firstName: null, lastName: null, fullName: null, companyName: "Acme A.Ş.", type: "corporate", phone: "02129990000" }

test("displayCustomerName: bireysel ad+soyad kullanır", () => {
  expect(displayCustomerName(indiv)).toBe("Ahmet Yılmaz")
})

test("displayCustomerName: kurumsal şirket adını kullanır", () => {
  expect(displayCustomerName(corp)).toBe("Acme A.Ş.")
})

test("displayCustomerName: null güvenli", () => {
  expect(displayCustomerName(null)).toBe("—")
})

test("buildUnifiedResults: önce araçlar (plaka etiketi + sahip alt-etiketi), sonra müşteriler", () => {
  const out = buildUnifiedResults({
    customers: [indiv],
    vehicles: [{ id: "v1", plate: "34ABC123", brand: "Renault", model: "Clio", customerId: "c1", customer: indiv }],
  })
  expect(out[0]).toEqual({
    kind: "vehicle", vehicleId: "v1", customerId: "c1", plate: "34ABC123",
    label: "34ABC123 — Renault Clio", sublabel: "Sahip: Ahmet Yılmaz",
  })
  expect(out[1]).toEqual({ kind: "customer", customerId: "c1", label: "Ahmet Yılmaz", sublabel: "05321112233" })
})

test("buildUnifiedResults: boş girdi → boş liste", () => {
  expect(buildUnifiedResults({ customers: [], vehicles: [] })).toEqual([])
})
```

- [ ] **Step 2: Testi çalıştır, BAŞARISIZ olduğunu gör**

Run: `bun test src/lib/search/unified-results.test.ts`
Expected: FAIL — modül yok (`Cannot find module '@/lib/search/unified-results'`).

- [ ] **Step 3: Minimal implementasyonu yaz**

`src/lib/search/unified-results.ts`:

```ts
export type CustomerLite = {
  id: string
  firstName: string | null
  lastName: string | null
  fullName: string | null
  companyName: string | null
  type: string // "individual" | "corporate"
  phone: string
}

export type VehicleLite = {
  id: string
  plate: string
  brand: string
  model: string
  customerId: string
  customer: CustomerLite | null
}

export type UnifiedResult =
  | { kind: "vehicle"; vehicleId: string; customerId: string; plate: string; label: string; sublabel: string }
  | { kind: "customer"; customerId: string; label: string; sublabel: string }

/** Görünen ad: kurumsal → companyName; bireysel → fullName ya da "ad soyad". */
export function displayCustomerName(c: CustomerLite | null | undefined): string {
  if (!c) return "—"
  if (c.type === "corporate") return (c.companyName || "").trim() || "Kurumsal müşteri"
  const full = (c.fullName || "").trim()
  if (full) return full
  const fl = `${(c.firstName || "").trim()} ${(c.lastName || "").trim()}`.trim()
  return fl || "İsimsiz müşteri"
}

/**
 * Müşteri + araç DB satırlarını tek, etiketli sonuç listesine birleştirir.
 * Önce araçlar (plaka araması birincil senaryo), sonra müşteriler.
 */
export function buildUnifiedResults(input: {
  customers: CustomerLite[]
  vehicles: VehicleLite[]
}): UnifiedResult[] {
  const vehicleResults: UnifiedResult[] = input.vehicles.map((v) => ({
    kind: "vehicle",
    vehicleId: v.id,
    customerId: v.customerId,
    plate: v.plate,
    label: `${v.plate} — ${v.brand} ${v.model}`.trim(),
    sublabel: `Sahip: ${displayCustomerName(v.customer)}`,
  }))

  const customerResults: UnifiedResult[] = input.customers.map((c) => ({
    kind: "customer",
    customerId: c.id,
    label: displayCustomerName(c),
    sublabel: c.phone,
  }))

  return [...vehicleResults, ...customerResults]
}
```

- [ ] **Step 4: Testi çalıştır, GEÇTİĞİNİ gör**

Run: `bun test src/lib/search/unified-results.test.ts`
Expected: 5 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add src/lib/search/unified-results.ts src/lib/search/unified-results.test.ts
git commit -m "feat: add unified customer+vehicle search result builder" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `GET /api/search/customer-vehicle` birleşik arama endpoint'i

Müşteri (ad/şirket/telefon) + araç (plaka/VIN) sorgular, `buildUnifiedResults` ile birleştirir.

**Files:**
- Create: `src/app/api/search/customer-vehicle/route.ts`

**Interfaces:**
- Consumes: `buildUnifiedResults` (Task 1); `requireAuth`, `prisma`.
- Produces: `GET /api/search/customer-vehicle?q=<text>` → `{ results: UnifiedResult[] }` (boş `q` → `{ results: [] }`). Task (Faz 2b) picker tüketir.

- [ ] **Step 1: Route'u yaz**

`src/app/api/search/customer-vehicle/route.ts`:

```ts
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { buildUnifiedResults } from "@/lib/search/unified-results"

export async function GET(request: Request) {
  const user = await requireAuth()
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") || "").trim()
  if (!q) return NextResponse.json({ results: [] })

  const customerSelect = Prisma.validator<Prisma.CustomerSelect>()({
    id: true,
    firstName: true,
    lastName: true,
    fullName: true,
    companyName: true,
    type: true,
    phone: true,
  })

  const [customers, vehicles] = await Promise.all([
    prisma.customer.findMany({
      where: {
        workshopId: user.workshopId,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { fullName: { contains: q, mode: "insensitive" } },
          { companyName: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
        ],
      },
      select: customerSelect,
      take: 8,
      orderBy: { createdAt: "desc" },
    }),
    prisma.vehicle.findMany({
      where: {
        workshopId: user.workshopId,
        OR: [
          { plate: { contains: q, mode: "insensitive" } },
          { vin: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        plate: true,
        brand: true,
        model: true,
        customerId: true,
        customer: { select: customerSelect },
      },
      take: 8,
      orderBy: { createdAt: "desc" },
    }),
  ])

  const results = buildUnifiedResults({ customers, vehicles })
  return NextResponse.json({ results })
}
```

> Not: `Prisma.validator<Prisma.CustomerSelect>()` ile sarmalanan reusable select, literal `true` değerlerini koruyarak Prisma'nın hem `findMany` hem nested `customer` sonuç-tipini doğru çıkarmasını sağlar (düz `as const` readonly sorununu önler). Seçilen alanlar `CustomerLite` ile örtüşür → `buildUnifiedResults`'a tip uyumlu geçer. `where` nesne literali kullanılır (mevcut `/api/customers`'taki `as any` KOPYALANMAZ).

- [ ] **Step 2: typecheck + lint + build**

Run: `bun run typecheck && bun run lint && bun run build`
Expected: typecheck 0 hata; lint YENİ hata/uyarı yok (proje genelinde ~9 önceden var olan uyarı senin değil); build exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/search/customer-vehicle/route.ts
git commit -m "feat: add unified customer+vehicle search API" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> **Manuel QA (kullanıcıya ertelendi — yerel DB yok):** Giriş yapılmış oturumda `GET /api/search/customer-vehicle?q=34` → eşleşen plakalı araçlar (sahip etiketiyle) + isim/telefonu eşleşen müşteriler dönmeli; başka workshop'un kaydı DÖNMEMELİ; boş `q` → `{ results: [] }`.

---

### Task 3: `changeVehicleOwnerAction` server action

Aracın sahibini güvenle (auth + workshop-kapsamlı) günceller; Faz 2b picker'ın "sahip değiştir" akışı çağırır.

**Files:**
- Modify: `src/app/(app)/vehicles/actions.ts` (yeni export ekle; dosya sonu)

**Interfaces:**
- Consumes: `requireAuth`, `prisma`, `AuditLogAction`, `revalidatePath` (dosyada zaten import'lu).
- Produces: `changeVehicleOwnerAction(vehicleId: string, newCustomerId: string): Promise<{ success: true; id: string } | { error: string }>`. Faz 2b picker tüketir.

- [ ] **Step 1: Aksiyonu ekle**

`src/app/(app)/vehicles/actions.ts` dosyasının SONUNA (mevcut `deleteVehicleAction`'dan sonra) ekle:

```ts
export async function changeVehicleOwnerAction(vehicleId: string, newCustomerId: string) {
  const user = await requireAuth()

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, workshopId: user.workshopId },
  })
  if (!vehicle) return { error: "Araç bulunamadı" }

  const customer = await prisma.customer.findFirst({
    where: { id: newCustomerId, workshopId: user.workshopId },
  })
  if (!customer) return { error: "Müşteri bulunamadı" }

  if (vehicle.customerId === newCustomerId) {
    return { success: true as const, id: vehicleId }
  }

  await prisma.vehicle.updateMany({
    where: { id: vehicleId, workshopId: user.workshopId },
    data: { customerId: newCustomerId },
  })

  await AuditLogAction(user.workshopId, user.id, "Vehicle", vehicleId, "vehicle_owner_changed")

  revalidatePath("/vehicles")
  revalidatePath(`/vehicles/${vehicleId}`)
  return { success: true as const, id: vehicleId }
}
```

> Not: `updateMany` + `where.workshopId` (savunma amaçlı, tek satır `update`'in aksine tenant-güvenli). Hem araç hem yeni müşteri workshop-kapsamlı doğrulanır. `as const` dönüş tipini `{ success: true; id }` olarak daraltır.

- [ ] **Step 2: typecheck + lint + build**

Run: `bun run typecheck && bun run lint && bun run build`
Expected: typecheck 0; lint yeni sorun yok; build exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/vehicles/actions.ts
git commit -m "feat: add changeVehicleOwnerAction (reassign vehicle owner)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> **Manuel QA (kullanıcıya ertelendi):** Bir aracın sahibini başka bir müşteriye değiştir → arama o aracı yeni sahiple getirir; aracın eski iş emirleri/kabulleri kendi (eski) müşterisini korur; başka workshop'un aracı/müşterisiyle çağrı "bulunamadı" döner.

---

## Faz 2a kapsam dışı (Faz 2b'de)

- Inline "müşteri + araç oluştur" modalı (`inline-create-modal.tsx`).
- Birleşik picker bileşeni (`customer-vehicle-picker.tsx`) — arama + seçim + "sahip değiştir" UI'ı + "sonuç yok → oluştur".
- `intake-wizard.tsx` adım 1-2'nin picker ile değiştirilmesi.

Faz 2b, 2a'nın API sözleşmesini (`{ results: UnifiedResult[] }`) ve `changeVehicleOwnerAction` imzasını tüketir. Aynı branch'te devam; Faz 2 (2a+2b) tek PR olarak sevk edilir.
