import Link from "next/link"
import { getAllPosts, getFeaturedPost } from "@/lib/blog/posts"
import { BlogCategoryFilters } from "./BlogCategoryFilters"
import styles from "./blog-page.module.css"

export function BlogIndex() {
  const posts = getAllPosts()
  const featured = getFeaturedPost(posts)
  const metaPosts = posts.map(({ content: _content, ...meta }) => meta)

  return (
    <div className={styles.page}>
      {/* Breadcrumb stays outside the bordered 1124 frame (Clutch pattern) */}
      <div className={styles.shell}>
        <nav className={styles.breadcrumb} aria-label="Sayfa konumu">
          <Link href="/">Ana sayfa</Link>
          <span aria-hidden="true">/</span>
          <span className={styles.breadcrumbCurrent}>Blog</span>
        </nav>
      </div>

      <section className={`${styles.shell} ${styles.hero}`}>
        <div className={styles.heroInner}>
          <h1>Oto servis operasyonu ve dijital dönüşüm üzerine yazılar</h1>
          <p className={styles.lead}>
            Araç kabul, iş emri, müşteri iletişimi ve atölye yazılımı hakkında pratik
            rehberler. Servisinizi büyütürken süreci sade tutmanıza yardımcı olacak
            notlar.
          </p>
        </div>
      </section>

      <main className={styles.main}>
        <BlogCategoryFilters posts={metaPosts} featuredSlug={featured?.slug ?? null} />
      </main>
    </div>
  )
}
