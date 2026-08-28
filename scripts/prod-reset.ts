import { Pool } from "pg"
import { buildPoolConfig } from "../src/lib/pg-connection"

/**
 * Kiracı verisini siler, global katalogları KORUR.
 *
 * Neden var: demo/deneme kullanıcıları prod'u kirlettiğinde tek istenen şey
 * atölye verisini sıfırlamak — ama araç kataloğu (37 bin `vehicle_type_details`
 * satırı) ve TecDoc/VIN cache'leri kalmalı: ilkini yeniden seed'lemek acılı
 * (bkz. docs/database.md), ikincisi harcanmış RapidAPI kotası.
 *
 * TRUNCATE bilerek CASCADE'SİZ: listede eksik bir referans veren tablo varsa
 * Postgres adını söyleyip iptal eder. CASCADE olsaydı korumak istediğimiz bir
 * tabloyu sessizce süpürebilirdi. Workshop ilişkilerinde `onDelete: Cascade`
 * olmadığı için tek tek DELETE FK sırasına bağımlı olurdu; TRUNCATE tek
 * transaction'da halleder.
 *
 * Kullanım (proje kökünden):
 *   1) Snapshot:  aws rds create-db-snapshot --db-instance-identifier bakimx-prod-db \
 *                   --db-snapshot-identifier bakimx-prod-pre-reset-<tarih> \
 *                   --profile bakimx-prod --region eu-central-1
 *      `Status=available` olmadan devam etmeyin.
 *   2) Tünel:     ENV=prod bash scripts/aws-dev-tunnel.sh   (localhost:5433)
 *   3) Secret:    aws secretsmanager get-secret-value --secret-id bakimx/prod/db-url \
 *                   --profile bakimx-prod --region eu-central-1 \
 *                   --query SecretString --output text > /tmp/.prod-db-url
 *   4) Rapor:     PROD_DB_URL_FILE=/tmp/.prod-db-url DB_SSL_NO_VERIFY=true bun run db:prod-reset
 *   5) Uygula:    ...aynı komut + `--confirm`
 *   6) Fotoğraf:  aws s3 rm s3://bakimx-media-prod/workshops/ --recursive --profile bakimx-prod
 *      (fotoğraflar DB'de değil, `STORAGE_PATH_PREFIX` altında S3'te durur)
 *   7) `/tmp/.prod-db-url` dosyasını silin.
 *
 * Sonrasında prod'da hiç atölye kalmaz — `/register` ile yeniden hesap açılır.
 * `PlatformAdmin` tablosu da boşaldığı için konsol erişimi yeniden `ADMIN_EMAILS`
 * bootstrap'ına düşer ve ilk yönetici girişinde tabloya geri yazılır (BAK-93).
 *
 * URL dosyadan okunur (argv/env'e düşmesin diye) ve host tünele çevrilir; bu
 * sayede tünel kapalıyken script uzak RDS'e doğrudan bağlanıp çalışamaz.
 */

const CONFIRM_FLAG = "--confirm"

/** `workshopId` taşıyan her tablo + atölyeye bağlı/ops-only tablolar. */
export const TENANT_TABLES = [
  "Workshop",
  "WorkshopSettings",
  "User",
  "Invite",
  "PasswordResetToken",
  "Customer",
  "Vehicle",
  "VehicleIntakeForm",
  "VehiclePhoto",
  "DamageMark",
  "ApprovalRequest",
  "PublicShareLink",
  "IntakeTimelineEvent",
  "Technician",
  "ServiceOrder",
  "ServiceOrderItem",
  "CollectionPayment",
  "Quote",
  "QuoteItem",
  "Appointment",
  "MaintenanceReminder",
  "PartStockItem",
  "StockMovement",
  "LaborCatalogItem",
  "AuditLog",
  "Supplier",
  "PartSupplierPrice",
  "VehiclePassportToken",
  "OcrLog",
  // Servisler arası araç geçmişi hakkı (BAK-77): `workshopId` taşır ve dayanağı
  // o atölyenin ruhsat taramasıdır — kiracı verisi silinirken hak da düşmeli,
  // yoksa yeni kiracı eski kiracının açtığı maskeyi devralırdı.
  "VehicleHistoryGrant",
  "ChecklistItem",
  "InternalNote",
  "PartsRequest",
  "LaborSession",
  "CommunicationTemplate",
  "CalendarSyncLog",
  "ReminderExecutionLog",
  "CommunicationLog",
  "BillingOrder",
  "PaymentTransaction",
  "ImpersonationSession",
  // Platform yöneticiliği (BAK-93) global bir yetkidir ama satırı `User`'a FK ile
  // bağlıdır ve o kullanıcı bu listede siliniyor — CASCADE'siz TRUNCATE, tablo
  // listede olmasaydı zaten iptal ederdi. Sıfırlama sonrası üyelik `ADMIN_EMAILS`
  // bootstrap'ından yeniden kurulur (bkz. dosya başı, `src/lib/admin.ts`).
  "PlatformAdmin",
  // Satış danışmanı profilleri personel User'ına, satış kayıtları ise demo ve
  // dönüşmüş Workshop satırlarına FK taşır. Bu reset tüm tenant/user verisini
  // sildiği için aynı transaction içinde bunlar da temizlenmelidir.
  "SalesAdvisor",
  "SalesAdvisorMonthlyTarget",
  "SalesAdvisorInvite",
  "SalesLead",
  "SalesRegistrationLink",
  "SalesLeadAssignment",
  "SalesActivity",
  "SalesTask",
  "SalesDemoSession",
  "SalesCommissionRule",
  "SalesCommission",
  "SalesCommissionEvent",
  "SalesDiscountCode",
  "SalesReferral",
  "CronRun",
  // Web Push abonelikleri (BAK-129): kiracının kullanıcılarına bağlı cihaz
  // kayıtları. Kalıcı iş verisi değil — silinince kullanıcılar bildirimleri
  // yeniden açar; kalsaydı yeni kiracının olayları eski cihazlara giderdi.
  "PushSubscription",
  // Paylaşımlı rate limit sayacı (BAK-116): kalıcı veri değil, dakikalık kova.
  // Anahtarları IP ve e-posta taşıdığı için korunanlarda değil burada — boşalması
  // yalnız o anki pencereyi sıfırlar.
  "RateLimitCounter",
  // BakımX sipariş TALEBİ (BAK-60): katalog tablolarının aksine kiracıya aittir
  // (`workshop_id` taşır), dolayısıyla korunanlarda değil burada. Kalem tablosu
  // aynı TRUNCATE listesinde olduğu için FK sırası sorun değil.
  "bakimx_orders",
  "bakimx_order_items",
  // Harici tedarik kaydı iş emri/kalemine bağlı kiracı verisidir.
  "ExternalProcurementOrder",
  "ExternalProcurementOrderItem",
  // Sağlayıcı webhook inbox'ı sipariş kimliği üzerinden kiracı operasyon
  // geçmişidir; kiracı siparişleri silinirken yetim dedupe kayıtları kalmamalı.
  "ExternalProcurementEvent",
  "quota_usage",
]

/** Dokunulmayanlar. Satır sayıları öncesi/sonrası karşılaştırılarak doğrulanır. */
export const KEEP_TABLES = [
  "vehicle_brands",
  "vehicle_models",
  "vehicle_types",
  "vehicle_type_details",
  "tecdoc_cache",
  "tecdoc_articles",
  "tecdoc_article_oems",
  "vin_lookups",
  // BakımX'in KENDİ ürün kataloğu: global, kiracıya ait değil — reset korumalı
  // (aksi hâlde prod sıfırlaması BakımX'in ürün/fiyat verisini de siler).
  "bakimx_product_brands",
  "bakimx_products",
  "bakimx_product_fitments",
  "bakimx_product_imports",
  "bakimx_catalog_audit",
  "DemoRequest",
  "SupportRequest",
  // Canlı destek (BAK-73): www.bakimx.com ziyaretçileriyle BakımX'in KENDİ
  // yazışması — kiracı verisi değil. Kiracı sıfırlaması destek geçmişini ve
  // widget ayarlarını silmemeli (aksi hâlde çalışma saatleri de sıfırlanırdı).
  "LiveChatSettings",
  "LiveChatConversation",
  "LiveChatMessage",
  "LiveChatResumeToken",
  // Herkese açık durum sayfası (BAK-128) platform geneli olay geçmişidir;
  // hiçbir atölyeye ait olmadığı için kiracı sıfırlamasında korunur.
  "status_incidents",
  "_prisma_migrations",
]

async function counts(pool: Pool, tables: string[]): Promise<Map<string, number>> {
  const sql = tables.map((t) => `SELECT '${t}' AS t, count(*)::int AS n FROM "${t}"`).join(" UNION ALL ")
  const { rows } = await pool.query<{ t: string; n: number }>(sql)
  return new Map(rows.map((r) => [r.t, r.n]))
}

function report(label: string, m: Map<string, number>): void {
  console.log(`\n── ${label} ──`)
  for (const [t, n] of m) if (n > 0) console.log(`  ${t.padEnd(26)} ${n}`)
}

async function main(): Promise<void> {
  const file = process.env.PROD_DB_URL_FILE
  if (!file) throw new Error("PROD_DB_URL_FILE gerekli (bkz. dosya başındaki kullanım notu)")

  const raw = (await import("node:fs")).readFileSync(file, "utf8").trim()
  const url = raw.replace(/@[^/]+\//, "@localhost:5433/")
  if (!/@localhost:5433\//.test(url)) {
    throw new Error("İptal: bağlantı yerel SSM tünelinden (localhost:5433) geçmeli")
  }
  console.log(`Hedef: localhost:5433 → ${raw.replace(/\/\/[^@]+@/, "//***@").replace(/\?.*$/, "")}`)

  const pool = new Pool({ ...buildPoolConfig(url), max: 1 })

  const tenantBefore = await counts(pool, TENANT_TABLES)
  const keepBefore = await counts(pool, KEEP_TABLES)
  report("SİLİNECEK KİRACI VERİSİ", tenantBefore)
  report("KORUNAN (değişmemeli)", keepBefore)

  const totalTenant = [...tenantBefore.values()].reduce((a, b) => a + b, 0)
  console.log(`\nToplam kiracı satırı: ${totalTenant}`)

  if (!process.argv.includes(CONFIRM_FLAG)) {
    console.log(`\nRAPOR MODU — hiçbir şey silinmedi. Uygulamak için ${CONFIRM_FLAG} ekleyin.`)
    await pool.end()
    return
  }

  const list = TENANT_TABLES.map((t) => `"${t}"`).join(", ")
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query(`TRUNCATE TABLE ${list} RESTART IDENTITY`)
    await client.query("COMMIT")
  } catch (e) {
    await client.query("ROLLBACK")
    throw e
  } finally {
    client.release()
  }
  console.log("\n✅ TRUNCATE commit edildi.")

  const tenantAfter = await counts(pool, TENANT_TABLES)
  const keepAfter = await counts(pool, KEEP_TABLES)
  const leftover = [...tenantAfter.values()].reduce((a, b) => a + b, 0)
  console.log(`\nKalan kiracı satırı: ${leftover} (beklenen 0)`)

  let drift = false
  for (const [t, n] of keepBefore) {
    const after = keepAfter.get(t) ?? -1
    if (after !== n) {
      drift = true
      console.error(`  ⛔ ${t}: ${n} → ${after}`)
    }
  }
  console.log(drift ? "\n⛔ KORUNAN TABLOLAR DEĞİŞTİ — snapshot'tan geri dönün!" : "\n✅ Korunan tablolar değişmedi.")
  report("KORUNAN (sonrası)", keepAfter)

  await pool.end()
}

// Testler listeleri import edebilsin diye: yalnız doğrudan çalıştırıldığında koş.
if (process.argv[1]?.endsWith("prod-reset.ts")) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
