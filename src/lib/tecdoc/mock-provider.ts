import type { TecdocProvider } from "./provider"
import categoriesFixture from "./fixtures/categories-v2.json"
import articlesFixture from "./fixtures/articles.json"
import suppliersFixture from "./fixtures/suppliers.json"

/** Real probed payloads for the mock-VIN car (FOCUS IV, vehicleId 134068).
 *  Categories are served for ANY vehicleId so dev QA works with any car;
 *  articles only for the probed category (100030 Fren balatası) — other
 *  leaves return an empty list, mirroring a thin category. */
export const MOCK_ARTICLES_CATEGORY_ID = 100030

export class MockTecdocProvider implements TecdocProvider {
  readonly name = "mock"

  async getCategories(): Promise<unknown> {
    return categoriesFixture
  }

  async getArticles(_vehicleId: number, categoryId: number): Promise<unknown> {
    if (categoryId === MOCK_ARTICLES_CATEGORY_ID) return articlesFixture
    return { countArticles: 0, articles: [] }
  }

  async getSuppliers(): Promise<unknown> {
    // Mock provider gerçek RapidAPI yanıtını gölgelememeli — cachedFetch
    // provider.name === "mock" ise cache'ye yazmaz (mock→rapidapi geçişinde
    // gerçek veri gelir). ~40 popüler marka örneği (tam liste RapidAPI'de 1264).
    return suppliersFixture
  }
}
