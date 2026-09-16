"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { BlogCategoryBadge } from "@/components/blog/category-badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BLOG_CATEGORIES,
  BLOG_CATEGORY_LABELS,
  type BlogCategory,
  type BlogPostMeta,
} from "@/lib/blog/types"
import styles from "./blog-page.module.css"

type FilterValue = "all" | BlogCategory

function authorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase()
}

function Cover({
  post,
  className,
  sizes,
  priority = false,
}: {
  post: BlogPostMeta
  className: string
  sizes: string
  priority?: boolean
}) {
  if (post.cover) {
    return (
      <div className={className}>
        <Image
          src={post.cover}
          alt={post.coverAlt ?? ""}
          fill
          sizes={sizes}
          priority={priority}
        />
      </div>
    )
  }

  return (
    <div className={className} aria-hidden="true">
      <div className={styles.coverFallback}>
        <span>{BLOG_CATEGORY_LABELS[post.category]}</span>
      </div>
    </div>
  )
}

function AuthorRow({ post }: { post: BlogPostMeta }) {
  return (
    <div className={styles.authorRow}>
      {post.author.avatar ? (
        <Image
          src={post.author.avatar}
          alt=""
          width={48}
          height={48}
          className={styles.authorAvatar}
        />
      ) : (
        <span className={styles.authorAvatarFallback} aria-hidden="true">
          {authorInitials(post.author.name)}
        </span>
      )}
      <div className={styles.authorMeta}>
        <span className={styles.authorName}>{post.author.name}</span>
        <span className={styles.authorRole}>{post.author.role}</span>
      </div>
    </div>
  )
}

export function BlogCategoryFilters({
  posts,
  featuredSlug,
}: {
  posts: BlogPostMeta[]
  featuredSlug: string | null
}) {
  const [filter, setFilter] = useState<FilterValue>("all")

  const featured =
    filter === "all" && featuredSlug
      ? posts.find((post) => post.slug === featuredSlug) ?? null
      : null

  const visible = useMemo(() => {
    const base =
      filter === "all" ? posts : posts.filter((post) => post.category === filter)
    if (!featuredSlug || filter !== "all") return base
    return base.filter((post) => post.slug !== featuredSlug)
  }, [filter, featuredSlug, posts])

  return (
    <>
      {featured ? (
        <article className={styles.featured}>
          <div className={styles.featuredBody}>
            <BlogCategoryBadge category={featured.category} />
            <h2 className={styles.featuredTitle}>
              <Link href={`/blog/${featured.slug}`}>{featured.title}</Link>
            </h2>
            <AuthorRow post={featured} />
          </div>
          <Link
            href={`/blog/${featured.slug}`}
            className={styles.featuredMediaLink}
            tabIndex={-1}
            aria-hidden="true"
          >
            <Cover
              post={featured}
              className={styles.featuredMedia}
              sizes="(max-width: 1023px) 100vw, 564px"
              priority
            />
          </Link>
        </article>
      ) : null}

      <Tabs
        value={filter}
        onValueChange={(value) => setFilter(value as FilterValue)}
        className="gap-0"
      >
        <TabsList
          variant="line"
          className={styles.filters}
          aria-label="Yazı kategorileri"
        >
          <TabsTrigger
            value="all"
            data-active={filter === "all"}
            className={styles.filterChip}
          >
            #Tümü
          </TabsTrigger>
          {BLOG_CATEGORIES.map((category) => (
            <TabsTrigger
              key={category}
              value={category}
              data-active={filter === category}
              className={styles.filterChip}
            >
              #{BLOG_CATEGORY_LABELS[category]}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={filter} className="m-0">
          {visible.length === 0 ? (
            <p className={styles.empty}>Bu kategoride henüz yazı yok.</p>
          ) : (
            <div className={styles.grid}>
              {visible.map((post) => (
                <article key={post.slug} className={styles.card}>
                  <Link
                    href={`/blog/${post.slug}`}
                    className={styles.cardMediaLink}
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <Cover
                      post={post}
                      className={styles.cardMedia}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </Link>
                  <div className={styles.cardBody}>
                    <BlogCategoryBadge category={post.category} />
                    <h2 className={styles.cardTitle}>
                      <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                    </h2>
                    <AuthorRow post={post} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  )
}
