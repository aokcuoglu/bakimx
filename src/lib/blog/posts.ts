import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"
import {
  BLOG_CATEGORIES,
  type BlogCategory,
  type BlogPost,
  type BlogPostMeta,
} from "./types"

const CONTENT_DIR = path.join(process.cwd(), "content/blog")

function isBlogCategory(value: unknown): value is BlogCategory {
  return typeof value === "string" && (BLOG_CATEGORIES as readonly string[]).includes(value)
}

function parsePostFile(filename: string): BlogPost {
  const slug = filename.replace(/\.mdx$/, "")
  const raw = fs.readFileSync(path.join(CONTENT_DIR, filename), "utf8")
  const { data, content } = matter(raw)

  if (typeof data.title !== "string" || !data.title.trim()) {
    throw new Error(`Blog post "${slug}" missing title`)
  }
  if (typeof data.description !== "string" || !data.description.trim()) {
    throw new Error(`Blog post "${slug}" missing description`)
  }
  if (!isBlogCategory(data.category)) {
    throw new Error(`Blog post "${slug}" has invalid category`)
  }
  if (typeof data.publishedAt !== "string" || Number.isNaN(Date.parse(data.publishedAt))) {
    throw new Error(`Blog post "${slug}" missing valid publishedAt`)
  }
  if (
    !data.author ||
    typeof data.author !== "object" ||
    typeof (data.author as { name?: unknown }).name !== "string" ||
    typeof (data.author as { role?: unknown }).role !== "string"
  ) {
    throw new Error(`Blog post "${slug}" missing author.name/role`)
  }

  const author = data.author as { name: string; role: string; avatar?: unknown; bio?: unknown }

  return {
    slug,
    title: data.title.trim(),
    description: data.description.trim(),
    category: data.category,
    publishedAt: data.publishedAt,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
    author: {
      name: author.name.trim(),
      role: author.role.trim(),
      bio: typeof author.bio === "string" ? author.bio : undefined,
      avatar: typeof author.avatar === "string" ? author.avatar : undefined,
    },
    cover: typeof data.cover === "string" ? data.cover : undefined,
    coverAlt: typeof data.coverAlt === "string" ? data.coverAlt : undefined,
    featured: data.featured === true,
    draft: data.draft === true,
    content,
  }
}

function listMdxFiles(): string[] {
  if (!fs.existsSync(CONTENT_DIR)) return []
  return fs.readdirSync(CONTENT_DIR).filter((name) => name.endsWith(".mdx"))
}

function byPublishedDesc(a: BlogPostMeta, b: BlogPostMeta): number {
  return Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
}

export function getAllPosts({ includeDrafts = false } = {}): BlogPost[] {
  return listMdxFiles()
    .map(parsePostFile)
    .filter((post) => includeDrafts || !post.draft)
    .sort(byPublishedDesc)
}

export function getPostSlugs(): string[] {
  return getAllPosts().map((post) => post.slug)
}

export function getPostBySlug(slug: string): BlogPost | null {
  const filename = `${slug}.mdx`
  if (!listMdxFiles().includes(filename)) return null
  const post = parsePostFile(filename)
  if (post.draft && process.env.NODE_ENV === "production") return null
  return post
}

/** Latest published post — pinned as the wide highlight on /blog. */
export function getFeaturedPost(posts: BlogPostMeta[] = getAllPosts()): BlogPostMeta | null {
  return posts[0] ?? null
}

/** Same category first, then newest published articles; never include this post. */
export function getRelatedPosts(post: BlogPostMeta, posts: BlogPostMeta[] = getAllPosts()): BlogPostMeta[] {
  return posts.filter((candidate) => !candidate.draft && candidate.slug !== post.slug)
    .sort((a, b) => Number(b.category === post.category) - Number(a.category === post.category)
      || byPublishedDesc(a, b) || a.slug.localeCompare(b.slug))
    .slice(0, 3)
}
