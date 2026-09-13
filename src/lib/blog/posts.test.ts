import { describe, expect, test } from "bun:test"
import { BLOG_CATEGORIES } from "./types"
import { getAllPosts, getFeaturedPost, getPostBySlug, getPostSlugs } from "./posts"

describe("blog content layer", () => {
  test("publishes at least one non-draft post with required fields", () => {
    const posts = getAllPosts()
    expect(posts.length).toBeGreaterThan(0)

    for (const post of posts) {
      expect(post.slug.length).toBeGreaterThan(0)
      expect(post.title.length).toBeGreaterThan(0)
      expect(post.description.length).toBeGreaterThan(0)
      expect(BLOG_CATEGORIES).toContain(post.category)
      expect(Number.isNaN(Date.parse(post.publishedAt))).toBe(false)
      expect(post.author.name.length).toBeGreaterThan(0)
      expect(post.content.trim().length).toBeGreaterThan(0)
      expect(post.draft).not.toBe(true)
    }
  })

  test("slugs are unique and resolvable", () => {
    const slugs = getPostSlugs()
    expect(new Set(slugs).size).toBe(slugs.length)

    for (const slug of slugs) {
      const post = getPostBySlug(slug)
      expect(post?.slug).toBe(slug)
    }
  })

  test("featured highlight is the newest published post", () => {
    const posts = getAllPosts()
    const featured = getFeaturedPost(posts)
    expect(featured?.slug).toBe(posts[0]?.slug)
  })
})
