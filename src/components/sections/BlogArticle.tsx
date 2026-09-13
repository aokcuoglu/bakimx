import Image from "next/image"
import Link from "next/link"
import { compileMDX } from "next-mdx-remote/rsc"
import { ArrowUpRight, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { blogMdxComponents } from "@/components/blog/mdx-components"
import { BlogCategoryBadge } from "@/components/blog/category-badge"
import { ArticleToc } from "@/components/blog/article-toc"
import { formatBlogDate } from "@/lib/blog/format"
import { articleAnalysisPlugin, type ArticleAnalysis } from "@/lib/blog/article"
import { getRelatedPosts } from "@/lib/blog/posts"
import { type BlogAuthor, type BlogPost } from "@/lib/blog/types"
import { SITE_URL } from "@/lib/seo"
import styles from "./blog-article.module.css"

function Author({ author }: { author: BlogAuthor }) {
  return <div className={styles.author}>
    {author.avatar ? <Image src={author.avatar} alt="" width={44} height={44} className={styles.avatar} /> :
      <span className={styles.avatar} aria-hidden="true">{author.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("tr-TR")}</span>}
    <div><span className={styles.authorName}>{author.name}</span><span className={styles.authorRole}>{author.role}</span></div>
  </div>
}

export async function BlogArticle({ post }: { post: BlogPost }) {
  const analysis: ArticleAnalysis = { headings: [], readingMinutes: 1 }
  const { content } = await compileMDX({ source: post.content, components: blogMdxComponents,
    options: { mdxOptions: { remarkPlugins: [articleAnalysisPlugin(analysis)] } } })
  const related = getRelatedPosts(post)
  const url = `${SITE_URL}/blog/${post.slug}`
  const shares = [
    { name: "X’te paylaş", href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(post.title)}`, icon: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg> },
    { name: "LinkedIn’de paylaş", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, icon: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5.37 24H.4V8h4.97zM2.88 5.82A2.88 2.88 0 1 1 2.9.06a2.88 2.88 0 0 1-.02 5.76zM24 24h-4.97v-7.79c0-1.86-.04-4.25-2.59-4.25-2.6 0-3 2.03-3 4.12V24H8.47V8h4.77v2.19h.07c.66-1.26 2.29-2.59 4.72-2.59C23.07 7.6 24 10.92 24 15.24z" /></svg> },
    { name: "E-posta ile paylaş", href: `mailto:?subject=${encodeURIComponent(post.title)}&body=${encodeURIComponent(url)}`, icon: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M1 3h22L12 11.25zM1 5.5l11 8.25L23 5.5V21H1z" /></svg> },
  ]
  return <main className={styles.page}>
    <nav aria-label="Gezinme yolu" className={styles.breadcrumb}><ol>
          <li><Link href="/">Ana sayfa</Link></li><li><ChevronRight aria-hidden="true" /><Link href="/blog">Blog</Link></li><li aria-current="page"><ChevronRight aria-hidden="true" />{post.title}</li>
        </ol></nav>
    <article className={styles.frame}>
      <header className={styles.hero}>
        <BlogCategoryBadge category={post.category} className={styles.categoryBadge} />
        <h1>{post.title}</h1>
        <p className={styles.metadata}><time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt)}</time><span aria-hidden="true">·</span>{analysis.readingMinutes} dk okuma</p>
        <Author author={post.author} />
      </header>
      <div className={styles.layout}>
        <aside className={styles.sidebar}><div className={styles.sticky}>
          <ArticleToc headings={analysis.headings} />
          <div className={styles.share}><p>Yazıyı paylaş</p><div>{shares.map((share) =>
            <a key={share.name} href={share.href} aria-label={share.name} target={share.href.startsWith("https:") ? "_blank" : undefined} rel={share.href.startsWith("https:") ? "noopener noreferrer" : undefined}>{share.icon}</a>
          )}</div></div>
        </div></aside>
        <div className={styles.column}>
          <div className={styles.body} data-blog-content>{content}</div>
          <section className={styles.cta} aria-label="Demo talebi"><h2>Servisinizi birlikte dijitale taşıyalım.</h2><Button asChild variant="navy"><Link href="/demo">Demo talep et<ArrowUpRight aria-hidden="true" /></Link></Button></section>
          <section className={styles.authorFooter} aria-label="Yazar hakkında"><Author author={post.author} />{post.author.bio && <p>{post.author.bio}</p>}</section>
          {related.length > 0 && <section className={styles.related} aria-labelledby="related-title"><h2 id="related-title">İlgili yazılar</h2><ul>{related.map((item) => <li key={item.slug}><Link href={`/blog/${item.slug}`}>{item.title}<ArrowUpRight aria-hidden="true" /></Link></li>)}</ul></section>}
        </div>
      </div>
    </article>
  </main>
}
