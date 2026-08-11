import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { FOLD_FROM, FOLD_TO, normalizePartSearchTerm } from "@/lib/tr-search"
import { countRapidApiCallsThisMonth, rapidApiMonthlyCap } from "@/lib/rapidapi-quota"
import { getTecdocProvider } from "./provider"
import { buildArticleOemRows } from "./oems"
import {
  dedupeBrands,
  normalizeArticleDetail,
  normalizeArticles,
  normalizeCategories,
  normalizeCrossRefs,
  normalizeSuppliers,
} from "./normalize"
import {
  TecdocError,
  TYPE_ID,
  LANG_ID,
  COUNTRY_FILTER_ID,
  type ArticleCompatibility,
  type ArticleCrossRef,
  type ArticleDetail,
  type ArticleOem,
  type ArticleSummary,
  type CategoryNode,
  type PartBrandSummary,
} from "./types"

/**
 * Cache-first TecDoc reads, mirroring src/lib/vin/lookup.ts: each (endpoint,
 * params) combination hits the paid provider at most once ever; the raw
 * payload is cached and normalized on read (schema fixes never invalidate the
 * cache). Transport/shape errors are NOT cached so they stay retryable.
 */
async function cachedFetch(
  key: string,
  endpoint: string,
  providerName: string,
  fetcher: () => Promise<unknown>
): Promise<unknown> {
  // Mock responses are free and deterministic — never persist them, otherwise
  // they shadow real data for the same key after switching to rapidapi.
  if (providerName === "mock") return fetcher()

  const cached = await prisma.tecdocCache.findUnique({ where: { key } })
  if (cached) {
    prisma.tecdocCache
      .update({ where: { key }, data: { hitCount: { increment: 1 } } })
      .catch(() => {}) // observability only
    return cached.rawResponse
  }

  if ((await countRapidApiCallsThisMonth()) >= rapidApiMonthlyCap()) {
    throw new TecdocError("quota_exceeded", "Aylık katalog sorgu limiti doldu. Lütfen daha sonra tekrar deneyin.")
  }

  const raw = await fetcher()
  await prisma.tecdocCache.upsert({
    where: { key }, // upsert: concurrent first-fetches must not crash
    create: { key, endpoint, rawResponse: raw as object },
    update: { hitCount: { increment: 1 } },
  })
  return raw
}

export async function getVehicleCategories(vehicleId: number): Promise<CategoryNode[]> {
  if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
    throw new TecdocError("invalid_params", "Geçersiz araç katalog kimliği.")
  }
  const provider = getTecdocProvider()
  const raw = await cachedFetch(
    `categories:v2:${TYPE_ID}:${vehicleId}:${LANG_ID}`,
    "categories",
    provider.name,
    () => provider.getCategories(vehicleId)
  )
  return normalizeCategories(raw)
}

export async function getArticlesByCategory(vehicleId: number, categoryId: number): Promise<ArticleSummary[]> {
  if (!Number.isInteger(vehicleId) || vehicleId <= 0 || !Number.isInteger(categoryId) || categoryId <= 0) {
    throw new TecdocError("invalid_params", "Geçersiz katalog parametreleri.")
  }
  const provider = getTecdocProvider()

  // First read normalized rows from DB — populated on first API fetch. Repeat
  // queries for the same (vehicleTypeId, categoryId) skip the paid RapidAPI call
  // (and even the raw JSON cache re-normalize) entirely. Mock provider never
  // persists rows (see write guard below), so skip the DB round-trip for it.
  if (provider.name !== "mock") {
    const rows = await prisma.tecdocArticle.findMany({ where: { vehicleTypeId: vehicleId, categoryId } })
    if (rows.length > 0) {
      return rows.map((r) => ({
        tecdocArticleId: r.tecdocArticleId,
        articleNo: r.articleNo,
        productName: r.productName,
        supplierName: r.supplierName,
        supplierId: r.supplierId,
        imageUrl: r.imageUrl,
      }))
    }
  }

  const raw = await cachedFetch(
    `articles:${TYPE_ID}:${vehicleId}:${categoryId}:${LANG_ID}`,
    "articles",
    provider.name,
    () => provider.getArticles(vehicleId, categoryId)
  )
  const articles = normalizeArticles(raw)

  // Persist normalized rows so the next read comes from DB directly. Mock data
  // must NOT be persisted (it would shadow real data after switching providers).
  if (provider.name !== "mock" && articles.length > 0) {
    try {
      await persistArticles(vehicleId, categoryId, articles)
    } catch (err) {
      // DB write failure must not block the user from seeing API data.
      console.error(
        `[tecdoc] article persist failed (vehicle=${vehicleId} category=${categoryId} count=${articles.length})`,
        err
      )
    }
  }

  return articles
}

/** Tek INSERT'e sığdırılacak satır sayısı (7 kolon × 1000 = 7000 bind parametresi,
 *  PG'nin 65535 sınırının çok altında). */
const PERSIST_CHUNK = 1000

/**
 * Normalize edilmiş makaleleri `tecdoc_articles`'a yazar.
 *
 * `createMany` (chunk başına TEK statement) kullanılır — satır-başına `upsert` ile
 * kurulan `$transaction([...])` batch'i, dizi formunda `timeout` seçeneği
 * OLMADIĞI için 5 sn'lik varsayılan sınıra takılıp TÜM batch'i geri alıyordu
 * (P2028); 199 satırlık bir kategori uzak DB gecikmesinde 5.6 sn sürüyor ve
 * hiçbir satır yazılmıyordu (bkz. "silecek süpürgesi" bulunamaması). Her chunk
 * kendi başına atomiktir ve `skipDuplicates` eşzamanlı ilk-getirmelerde çakışmayı
 * yutar. Güncelleme dalına gerek yok: çağıran zaten satır varsa DB'den döner.
 */
export async function persistArticles(
  vehicleId: number,
  categoryId: number,
  articles: ArticleSummary[]
): Promise<number> {
  // Sağlayıcı aynı makaleyi iki kez döndürebilir; unique anahtar (araç, kategori,
  // makale) olduğu için chunk içi tekrarları baştan eleriz.
  const unique = [...new Map(articles.map((a) => [a.tecdocArticleId, a])).values()]
  let written = 0
  for (let i = 0; i < unique.length; i += PERSIST_CHUNK) {
    const res = await prisma.tecdocArticle.createMany({
      data: unique.slice(i, i + PERSIST_CHUNK).map((a) => ({
        vehicleTypeId: vehicleId,
        categoryId,
        tecdocArticleId: a.tecdocArticleId,
        articleNo: a.articleNo,
        productName: a.productName,
        supplierName: a.supplierName,
        supplierId: a.supplierId,
        imageUrl: a.imageUrl,
      })),
      skipDuplicates: true,
    })
    written += res.count
  }
  return written
}

/**
 * Parça detayı — özellikler, OEM numaraları, EAN, görsel ve uyumlu araç listesi
 * TEK faturalı çağrıdan gelir (bkz. rapidapi-provider.getArticleDetail probe
 * notu). Cache kalıcı: aynı parça ömür boyu bir kez faturalanır.
 *
 * Dönen `compatibleCars` 300+ kayıt olabilir — istemciye gönderilmez, yalnız
 * getArticleCompatibility içinde eşleşme aramak için kullanılır.
 */
export async function getArticleDetail(articleId: number): Promise<ArticleDetail> {
  if (!Number.isInteger(articleId) || articleId <= 0) {
    throw new TecdocError("invalid_params", "Geçersiz parça kimliği.")
  }
  const provider = getTecdocProvider()
  const raw = await cachedFetch(
    `article-detail:${articleId}:${COUNTRY_FILTER_ID}:${LANG_ID}`,
    "article-detail",
    provider.name,
    () => provider.getArticleDetail(articleId)
  )
  const detail = normalizeArticleDetail(raw, articleId)

  // OEM numaralarını aranabilir satırlara indir (#312). Cache isabetinde de
  // çalışır — tablo detay ucundan SONRA geldiği için eski cache'ler ancak böyle
  // (ya da `db:backfill-article-oems` ile) dolar. Mock veri persist EDİLMEZ:
  // sağlayıcı hangi articleId istenirse istensin aynı örneği döndürüyor, gerçek
  // parçaların numaralarını gölgelerdi (bkz. persistArticles'taki aynı kural).
  if (provider.name !== "mock" && detail.oems.length > 0) {
    try {
      await persistArticleOems(articleId, detail.oems)
    } catch (err) {
      // Arama indeksi eksik kalabilir; parça detayı yine açılmalı.
      console.error(`[tecdoc] OEM persist failed (article=${articleId})`, err)
    }
  }

  return detail
}

/**
 * Parçanın OEM numaralarını `tecdoc_article_oems`'e yazar — idempotent
 * (`skipDuplicates`), tek statement. `articleId` çağıranın istediği kimliktir:
 * `tecdoc_articles.tecdoc_article_id` ile aynı değer olmalı ki arama JOIN'i tutsun
 * (sağlayıcı gövdede kimliği boş bırakabiliyor — bkz. normalizeArticleDetail).
 */
export async function persistArticleOems(articleId: number, oems: ArticleOem[]): Promise<number> {
  const rows = buildArticleOemRows(articleId, oems)
  if (rows.length === 0) return 0
  const res = await prisma.tecdocArticleOem.createMany({ data: rows, skipDuplicates: true })
  return res.count
}

/** Muadil / çapraz referanslar — ayrı (tembel) çağrı, kullanıcı bölümü açınca. */
export async function getArticleCrossRefs(articleId: number): Promise<ArticleCrossRef[]> {
  if (!Number.isInteger(articleId) || articleId <= 0) {
    throw new TecdocError("invalid_params", "Geçersiz parça kimliği.")
  }
  const provider = getTecdocProvider()
  const raw = await cachedFetch(
    `article-xref:${articleId}:${LANG_ID}`,
    "article-xref",
    provider.name,
    () => provider.getArticleCrossRefs(articleId)
  )
  return normalizeCrossRefs(raw)
}

/**
 * Parça bu araca uyuyor mu?
 *
 * İki kaynak: (1) parçanın kendi uyumlu-araç listesi — otoriter ve eşleşen
 * kayıt "neden uygun" cevabını da verir (motor + üretim aralığı); (2) yerel
 * `tecdoc_articles` linkage'ı — parça zaten bu araç için listelenmişse.
 *
 * DÜRÜSTLÜK: hiçbiri tutmuyorsa "uygun DEĞİL" denmez, `unknown` döner. Yerel
 * katalog kapsamı best-effort (yalnız gezilmiş/prefetch'lenmiş kategoriler) ve
 * TR ülke filtresi bazı varyantları eliyor — negatif iddia yanlış olur.
 */
export async function getArticleCompatibility(
  vehicleTypeId: number,
  detail: ArticleDetail
): Promise<ArticleCompatibility> {
  const fitment = detail.compatibleCars.find((c) => c.vehicleId === vehicleTypeId) ?? null
  if (fitment) return { status: "linked", fitment }

  const linked = await prisma.tecdocArticle.findFirst({
    where: { vehicleTypeId, tecdocArticleId: detail.tecdocArticleId },
    select: { id: true },
  })
  return { status: linked ? "linked" : "unknown", fitment: null }
}

/**
 * Parça markaları (TecDoc suppliers) — araç-bağımsız, tek sefer çekilir ve
 * cache'lenir. Cache key `suppliers:list` (vehicleId parametresi YOK). Mock
 * provider cachedFetch içinde cache'ye yazılmaz (mock→rapidapi geçişinde
 * gerçek veri gelir).
 */
export async function getPartBrands(): Promise<PartBrandSummary[]> {
  const provider = getTecdocProvider()
  const raw = await cachedFetch(
    "suppliers:list",
    "suppliers",
    provider.name,
    () => provider.getSuppliers()
  )
  return normalizeSuppliers(raw)
}

/**
 * Araç-scoped markalar — bu araç için cache'lenmiş TecdocArticle satırlarındaki
 * distinct supplier'lar. Kategori seçilmeden önce marka combobox'ını doldurur.
 * Best-effort: yalnız daha önce göz atılıp persist edilmiş kategoriler katkı verir.
 */
export async function getVehicleBrands(vehicleId: number): Promise<PartBrandSummary[]> {
  if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
    throw new TecdocError("invalid_params", "Geçersiz araç katalog kimliği.")
  }
  const rows = await prisma.tecdocArticle.findMany({
    where: { vehicleTypeId: vehicleId },
    select: { supplierId: true, supplierName: true },
  })
  return dedupeBrands(rows)
}

/**
 * Kategori-scoped markalar — GÜVENİLİR yol. getArticlesByCategory o kategorinin
 * makalelerini (yoksa provider'dan çekip persist ederek) döner; distinct supplier.
 */
export async function getCategoryBrands(vehicleId: number, categoryId: number): Promise<PartBrandSummary[]> {
  const articles = await getArticlesByCategory(vehicleId, categoryId)
  return dedupeBrands(articles.map((a) => ({ supplierId: a.supplierId, supplierName: a.supplierName })))
}

/**
 * Arama sonucu — parça özeti + (satırı doldurmak için) kategori kimliği/adı +
 * sorguyla eşleşen OEM numaraları (#312). `matchedOems` yalnız kullanıcı bir OEM
 * numarası yazdığında dolar; satırda "neden bu parça çıktı" cevabını verir.
 */
export type ArticleSearchResult = ArticleSummary & {
  categoryId: number
  categoryName: string
  matchedOems: string[]
}

/** Bir parça için satırda gösterilecek en fazla eşleşen OEM numarası. */
const MATCHED_OEM_LIMIT = 2

/**
 * Kolonu JS'teki `normalizePartSearchTerm` ile AYNI anahtara indirger (Prisma
 * where'i kolon üzerinde fonksiyon çağıramaz → yalnız $queryRaw içinde kullanılır).
 * Katlama tablosu iki uçta ortak (FOLD_FROM/FOLD_TO).
 */
const fold = (col: string) =>
  Prisma.sql`regexp_replace(translate(lower(${Prisma.raw(col)}), ${FOLD_FROM}, ${FOLD_TO}), '[^a-z0-9]', '', 'g')`

/** OEM satırı bu terimle eşleşiyor mu — numara (yazarken katlanmış) ya da marka. */
const oemTermMatch = (pattern: string) =>
  Prisma.sql`(o.search_key LIKE ${pattern} OR ${fold("o.brand")} LIKE ${pattern})`

/**
 * Süreç-içi memo: kategori ağacı değişmeyen referans veridir (cachedFetch satırı
 * yalnız bir kez yazılır) ve arama her (debounce'lu) tuş vuruşunda çağrılır — aynı
 * araç için ~70 KB'lık payload'ı tekrar tekrar okuyup normalize etmeyelim. Boyut
 * sınırlı: filo başına birkaç araç, taşarsa en eski giriş düşer.
 */
const CATEGORY_NAME_MEMO_MAX = 50
const categoryNameMemo = new Map<number, Map<number, string>>()

/**
 * Kategori id→ad haritası — YALNIZ raw JSON cache'inden okur, provider'a GİTMEZ,
 * böylece arama yolu kesin kotasız kalır (getVehicleCategories cache boşsa ücretli
 * çağrı yapardı). Ağaç cache'de yoksa boş harita döner: parça sonuçları yine
 * döner, sadece kategori adı boş kalır ve kategori adına göre eşleşme yapılamaz.
 * `tecdoc_articles` satırları ancak gerçek sağlayıcıyla dolduğu (mock asla persist
 * etmez) ve kategoriye göz atmadan parça persist edilemediği için, satır varsa
 * kategori ağacı da cache'de olur.
 */
async function getCachedCategoryNames(vehicleId: number): Promise<Map<number, string>> {
  const memo = categoryNameMemo.get(vehicleId)
  if (memo) return memo
  const nameById = new Map<number, string>()
  try {
    const cached = await prisma.tecdocCache.findUnique({
      where: { key: `categories:v2:${TYPE_ID}:${vehicleId}:${LANG_ID}` },
      select: { rawResponse: true },
    })
    if (!cached) return nameById
    const walk = (nodes: CategoryNode[]) => {
      for (const n of nodes) {
        nameById.set(n.id, n.name)
        if (n.children.length) walk(n.children)
      }
    }
    walk(normalizeCategories(cached.rawResponse))
  } catch {
    /* kategori adı çözülemese de parça sonucu dönmeli */
  }
  // Boş harita memo'lanmaz: ağaç sonradan cache'lenirse (kullanıcı kategoriye göz
  // atınca) aynı süreçte kalıcı olarak boş dönmesin.
  if (nameById.size > 0) {
    if (categoryNameMemo.size >= CATEGORY_NAME_MEMO_MAX) {
      const oldest = categoryNameMemo.keys().next()
      if (!oldest.done) categoryNameMemo.delete(oldest.value)
    }
    categoryNameMemo.set(vehicleId, nameById)
  }
  return nameById
}

/**
 * Bu araç için cache'lenmiş parçalarda parça NUMARASI, ADI, MARKASI (supplier),
 * KATEGORİ ADI veya OEM NUMARASI ile arama — SADECE DB okur (provider fetch YOK,
 * kotasız). Sağlayıcıda numara-arama ucu olmadığı için best-effort: yalnız daha
 * önce göz atılmış (persist edilmiş) kategorilerdeki parçaları bulur. Kategori adı
 * cache'li ağaçtan çözülür (bkz. getCachedCategoryNames); OEM numaraları
 * `tecdoc_article_oems`'ten gelir (yalnız detayı bir kez getirilmiş parçalar —
 * bkz. getArticleDetail / db:backfill-article-oems).
 */
export async function searchVehicleArticles(
  vehicleId: number,
  query: string,
  opts: { supplierId?: number | null; categoryId?: number | null; limit?: number } = {}
): Promise<ArticleSearchResult[]> {
  if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
    throw new TecdocError("invalid_params", "Geçersiz araç katalog kimliği.")
  }
  const { supplierId = null, categoryId = null, limit = 20 } = opts
  const hasFilter = supplierId != null || categoryId != null
  const q = query.trim()
  // Böngöz: filtre yoksa kısa query hiçbir şey döndürmez; filtre varsa boş
  // query'de bile o grubun parçaları listelenir (kullanıcı yazınca daralır).
  if (q.length < 2 && !hasFilter) return []
  // Ayraç-duyarsız arama: DB'de parça no "C 27 125" gibi boşluklu saklanırken
  // kullanıcı "C27125" yazınca da eşleşsin diye kolonu da sorguyu da harf/rakama
  // indirip karşılaştırırız. Aynı normalize tüm metin alanları için geçerli — yani
  // "hava filtresi" ↔ "havafiltresi" de bulunur. `translate` adımı Türkçe/aksanlı
  // harfleri ASCII'ye katlar (süpürge→supurge); onsuz [^a-z0-9] süzgeci ü/ö/ş'yi
  // silip ASCII klavyeyle yazan kullanıcıyı sonuçsuz bırakıyordu.
  // Katlama tablosu JS ile ORTAK (FOLD_FROM/FOLD_TO) — iki uç birebir aynı anahtarı
  // üretmeli. Prisma where'i kolon üzerinde fonksiyon çağıramadığından bu adım
  // $queryRaw ile yapılır; sonuç kümesi araca (vehicle_type_id) scope'lu ve
  // LIMIT'li kaldığı için maliyet düşük.
  //
  // Terim başına AND, alan başına OR: boşlukla ayrılan her terim numara/ad/MARKA/
  // KATEGORİ/OEM alanlarından herhangi birinde eşleşmeli. Böylece "marka" yazınca da
  // ("bbr"), marka+ad birlikte yazınca da ("bbr kabin filtre") süzülür. Tek terim
  // durumunda bu, eski tek-parça eşleşmesinin üst kümesidir (terim, tüm sorgunun
  // normalize hâlinin alt-dizesi) → daralma/regresyon yok.
  //
  // OEM dalı ayrı tabloya EXISTS ile bağlanır: bir parçanın onlarca numarası
  // olabildiği için JOIN satırları çoğaltırdı. `search_key` yazarken katlandığı
  // için numarada fold'a gerek yok — "KK2Q 6C301 CA" da "kk2q-6c301-ca" da aynı
  // "kk2q6c301ca" anahtarına iner (bkz. buildArticleOemRows). OEM MARKASI da
  // eşleşir: detay ekranındaki çip "FORD KK2Q-6C301-CA" yazıyor, kullanıcı çoğu
  // zaman tamamını kopyalıyor — marka terimi eşleşmeseydi sonuç boş dönerdi.
  const terms = q.length >= 2 ? q.split(/\s+/).map(normalizePartSearchTerm).filter(Boolean) : []
  const conditions: Prisma.Sql[] = [Prisma.sql`vehicle_type_id = ${vehicleId}`]
  if (supplierId != null) conditions.push(Prisma.sql`supplier_id = ${supplierId}`)
  if (categoryId != null) conditions.push(Prisma.sql`category_id = ${categoryId}`)
  // Kategori adı `tecdoc_articles`'da kolon DEĞİL (yalnız category_id var) → adı
  // cache'li ağaçta JS tarafında eşleştirip eşleşen id kümesini SQL'e taşırız.
  // Harita sonuç eşlemesinde de kullanılacağı için bir kez okunur (raw payload
  // büyük olabilir, iki kez çekmeye değmez).
  let categoryNames: Map<number, string> | null = terms.length > 0 ? await getCachedCategoryNames(vehicleId) : null
  const foldedCategories = categoryNames
    ? [...categoryNames].map(([id, name]) => [id, normalizePartSearchTerm(name)] as const)
    : []
  for (const term of terms) {
    const pattern = `%${term}%` // term zaten harf/rakama indirgendi → LIKE joker'i (% _) içermez
    const branches: Prisma.Sql[] = [
      Prisma.sql`${fold("article_no")} LIKE ${pattern}`,
      Prisma.sql`${fold("product_name")} LIKE ${pattern}`,
      Prisma.sql`${fold("supplier_name")} LIKE ${pattern}`,
      Prisma.sql`EXISTS (
        SELECT 1 FROM tecdoc_article_oems o
        WHERE o.tecdoc_article_id = tecdoc_articles.tecdoc_article_id AND ${oemTermMatch(pattern)}
      )`,
    ]
    const catIds = foldedCategories.filter(([, name]) => name.includes(term)).map(([id]) => id)
    if (catIds.length > 0) branches.push(Prisma.sql`category_id IN (${Prisma.join(catIds)})`)
    conditions.push(Prisma.sql`(${Prisma.join(branches, " OR ")})`)
  }
  const rows = await prisma.$queryRaw<
    Array<{
      tecdocArticleId: number
      articleNo: string
      productName: string
      supplierName: string
      supplierId: number | null
      imageUrl: string | null
      categoryId: number
    }>
  >(Prisma.sql`
    SELECT * FROM (
      SELECT DISTINCT ON (tecdoc_article_id)
        tecdoc_article_id AS "tecdocArticleId",
        article_no        AS "articleNo",
        product_name      AS "productName",
        supplier_name     AS "supplierName",
        supplier_id       AS "supplierId",
        image_url         AS "imageUrl",
        category_id       AS "categoryId"
      FROM tecdoc_articles
      WHERE ${Prisma.join(conditions, " AND ")}
      -- DISTINCT ON: aynı makale birden çok kategoride cache'lenebilir (unique
      -- anahtar araç+kategori+makale) → liste aynı parçayı iki kez gösteriyordu
      -- (React'te de yinelenen key). En küçük category_id'yi temsilci seçeriz.
      ORDER BY tecdoc_article_id, category_id
    ) a
    ORDER BY "articleNo" ASC
    LIMIT ${limit}
  `)
  if (rows.length === 0) return []
  // Kategori adlarını cache'li ağaçtan çöz (id→ad). Ağaç cache'de yoksa ad boş
  // kalır ama parça sonucu yine döner.
  categoryNames ??= await getCachedCategoryNames(vehicleId)
  const nameById = categoryNames
  const oemsByArticle = await findMatchedOems(rows.map((r) => r.tecdocArticleId), terms)
  return rows.map((r) => ({
    tecdocArticleId: r.tecdocArticleId,
    articleNo: r.articleNo,
    productName: r.productName,
    supplierName: r.supplierName,
    supplierId: r.supplierId,
    imageUrl: r.imageUrl,
    categoryId: r.categoryId,
    categoryName: nameById.get(r.categoryId) ?? "",
    matchedOems: oemsByArticle.get(r.tecdocArticleId) ?? [],
  }))
}

/**
 * Dönen parçaların sorguyla eşleşen OEM numaraları (parça başına en fazla
 * MATCHED_OEM_LIMIT). Ayrı sorgu: ana sorguda JOIN etmek DISTINCT ON'lu satırları
 * çoğaltırdı. Sonuç kümesi zaten LIMIT'li olduğu için maliyeti düşük; hiçbir terim
 * OEM'e uymuyorsa harita boş döner ve satırda hiçbir şey gösterilmez.
 */
async function findMatchedOems(articleIds: number[], terms: string[]): Promise<Map<number, string[]>> {
  const byArticle = new Map<number, string[]>()
  if (articleIds.length === 0 || terms.length === 0) return byArticle
  const rows = await prisma.$queryRaw<Array<{ tecdocArticleId: number; oemNo: string }>>(Prisma.sql`
    SELECT o.tecdoc_article_id AS "tecdocArticleId", o.oem_no AS "oemNo"
    FROM tecdoc_article_oems o
    WHERE o.tecdoc_article_id IN (${Prisma.join(articleIds)})
      AND (${Prisma.join(terms.map((t) => oemTermMatch(`%${t}%`)), " OR ")})
    ORDER BY o.oem_no ASC
  `)
  for (const r of rows) {
    const list = byArticle.get(r.tecdocArticleId)
    if (!list) byArticle.set(r.tecdocArticleId, [r.oemNo])
    else if (list.length < MATCHED_OEM_LIMIT) list.push(r.oemNo)
  }
  return byArticle
}

/**
 * Bir markanın (supplierId) bu araç için cache'lenmiş makalelerinin bulunduğu
 * distinct categoryId'ler — best-effort marka→kategori filtresi. Sadece DB okur,
 * provider fetch YAPMAZ (eksik olabilir; kabul edilen davranış).
 */
export async function getBrandCategoryIds(vehicleId: number, supplierId: number): Promise<number[]> {
  if (
    !Number.isInteger(vehicleId) || vehicleId <= 0 ||
    !Number.isInteger(supplierId) || supplierId <= 0
  ) {
    throw new TecdocError("invalid_params", "Geçersiz katalog parametreleri.")
  }
  const rows = await prisma.tecdocArticle.findMany({
    where: { vehicleTypeId: vehicleId, supplierId },
    select: { categoryId: true },
    distinct: ["categoryId"],
  })
  return rows.map((r) => r.categoryId)
}
