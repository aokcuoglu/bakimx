import { expect, test } from "bun:test"
import { compileMDX } from "next-mdx-remote/rsc"
import { renderToStaticMarkup } from "react-dom/server"
import { articleAnalysisPlugin, type ArticleAnalysis } from "./article"
import { getAllPosts, getRelatedPosts } from "./posts"

async function analyze(source: string) {
  const analysis: ArticleAnalysis = { headings: [], readingMinutes: 1 }
  const { content } = await compileMDX({ source, options: { mdxOptions: { remarkPlugins: [articleAnalysisPlugin(analysis)] } } })
  return { ...analysis, html: renderToStaticMarkup(content) }
}

test("Turkish, formatted and repeated headings have stable unique rendered anchors", async () => {
  const result = await analyze('## İş **emri** ve `Ölçüm`\n\n### İş emri ve Ölçüm\n\n## İş emri ve Ölçüm 2\n\n## İş emri ve Ölçüm\n\n```md\n## Sahte başlık\n```')
  expect(result.headings.map((h) => h.id)).toEqual(["is-emri-ve-olcum", "is-emri-ve-olcum-2", "is-emri-ve-olcum-2-2", "is-emri-ve-olcum-3"])
  expect(result.headings[0].text).toBe("İş emri ve Ölçüm")
  expect(result.headings[1].depth).toBe(3)
  for (const h of result.headings) expect(result.html).toContain(`id="${h.id}"`)
})

test("reading time counts visible text, excludes link destinations and rounds up", async () => {
  expect((await analyze("")).readingMinutes).toBe(1)
  expect((await analyze(Array(200).fill("kelime").join(" "))).readingMinutes).toBe(1)
  expect((await analyze(Array(201).fill("kelime").join(" "))).readingMinutes).toBe(2)
  expect((await analyze(`[metin](https://example.com/${Array(300).fill("url").join("/")})`)).readingMinutes).toBe(1)
})

test("related posts prioritize category then recency, excluding self and drafts", () => {
  const post = getAllPosts()[0]
  const candidate = (slug: string, category = post.category, publishedAt = "2026-09-01", draft = false) => ({ ...post, slug, category, publishedAt, draft })
  const other = post.category === "rehber" ? "urun" : "rehber"
  expect(getRelatedPosts(post, [post, candidate("draft", post.category, "2026-09-12", true), candidate("other", other, "2026-09-12"), candidate("old"), candidate("new", post.category, "2026-09-10"), candidate("fourth", other, "2026-08-01")]).map((p) => p.slug)).toEqual(["new", "old", "other"])
})
