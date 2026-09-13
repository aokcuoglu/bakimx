import type { Root, RootContent } from "mdast"

export type BlogHeading = { id: string; text: string; depth: 2 | 3 }
export type ArticleAnalysis = { headings: BlogHeading[]; readingMinutes: number }

function visibleText(node: Root | RootContent): string {
  if (node.type === "text" || node.type === "inlineCode" || node.type === "code") return node.value
  if (node.type === "image") return node.alt ?? ""
  if ("children" in node) return node.children.map(visibleText).join(node.type === "root" ? " " : "")
  return ""
}

/** Runs inside the existing MDX compilation; code fences cannot become headings. */
export function articleAnalysisPlugin(analysis: ArticleAnalysis) {
  return function plugin() {
    return (tree: Root) => {
      const ids = new Set<string>()
      const words: string[] = []
      function walk(node: Root | RootContent) {
        if (node.type === "heading") {
          const text = visibleText(node)
          const base = text.toLocaleLowerCase("tr-TR").replace(/ı/g, "i")
            .normalize("NFKD").replace(/\p{M}/gu, "")
            .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "bolum"
          let id = base
          for (let suffix = 2; ids.has(id); suffix++) id = `${base}-${suffix}`
          ids.add(id)
          node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id, tabIndex: -1 } }
          if (node.depth === 2 || node.depth === 3) analysis.headings.push({ id, text, depth: node.depth })
        }
        if (node.type === "text" || node.type === "inlineCode" || node.type === "code") words.push(node.value)
        if ("children" in node) node.children.forEach(walk)
      }
      analysis.headings.length = 0
      walk(tree)
      analysis.readingMinutes = Math.max(1, Math.ceil((words.join(" ").match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0) / 200))
    }
  }
}
