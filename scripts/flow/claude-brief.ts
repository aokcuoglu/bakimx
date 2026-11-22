#!/usr/bin/env bun
// Claude Code SessionStart hook: puts the BakımX flow rules and the live integration state into the
// session context, so parallel sessions see each other's work (docs/harness/README.md). Never fails
// the session: any error only shortens the brief.
import { execFileSync } from "node:child_process"
import { resolve } from "node:path"

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()

function run(args: string[], cwd = root, timeout = 8000, cmd = "git"): string {
  return execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout }).trim()
}
function attempt<T>(fn: () => T): T | null {
  try {
    return fn()
  } catch {
    return null
  }
}

interface Worktree {
  path: string
  branch: string | null
}

function worktrees(): Worktree[] {
  const list: Worktree[] = []
  for (const block of run(["worktree", "list", "--porcelain"]).split("\n\n")) {
    const path = block.match(/^worktree (.+)$/m)?.[1]
    if (!path) continue
    list.push({ path, branch: block.match(/^branch refs\/heads\/(.+)$/m)?.[1] ?? null })
  }
  return list
}

const all = attempt(worktrees) ?? []
const primary = all[0]?.path ?? root
const here = attempt(() => run(["rev-parse", "--show-toplevel"])) ?? root

const lines = [
  "BakımX flow (docs/harness/README.md; tool-neutral contract: docs/agent-workflows/issue-delivery.md) — every development:",
  "1. GitHub Issue first (/issue), then a worktree from fresh origin/dev: ../bakimx-<N>, branch issue/<N>-<slug>. Never commit on dev/main; never edit files in the primary checkout.",
  "2. origin/dev is the ONLY integration point: PR --base dev (Closes #N, + Closes BAK-x if Multica tracks it) → quality CI green → squash-merge without asking → `git merge --ff-only origin/dev` in the primary checkout → visible on localhost:3001. Never merge feature branches into local dev.",
  "3. main = production: merging dev → main deploys app.bakimx.com. Only as a versioned release with the user's explicit approval (/release-check).",
  "4. /ship <N|description> runs the pipeline with the bakimx-* agents (planner → developer → reviewer + ui-ux → qa). Reply to the user in Turkish.",
  `Primary checkout ${primary} stays on dev and serves localhost:3001 — never build, stash, reset or kill its server; worktree QA servers use port 32NN.`,
]

if (attempt(() => run(["fetch", "--quiet", "origin", "dev", "main", "--tags"], root, 15000)) === null) {
  lines.push("(offline: state below may be stale)")
}

attempt(() => {
  const tag = run(["describe", "--tags", "--abbrev=0", "origin/main"])
  const pending = run(["log", "--first-parent", "--format=%s", "origin/main..origin/dev"]).split("\n").filter(Boolean)
  const prs = pending.filter((s) => /\(#\d+\)$|^Merge pull request/.test(s)).length
  lines.push("", `Latest release: ${tag}. origin/dev is ${pending.length} commit(s) (${prs} merged PR(s)) ahead of main.`)
})

// Primary checkout: anything here that is not on origin/dev is invisible to new worktrees.
attempt(() => {
  const branch = run(["rev-parse", "--abbrev-ref", "HEAD"], primary)
  const [ahead, behind] = run(["rev-list", "--left-right", "--count", "dev...origin/dev"], primary).split(/\s+/).map(Number)
  const dirty = run(["status", "--porcelain"], primary).split("\n").filter(Boolean)
  const modified = dirty.filter((line) => !line.startsWith("??"))
  const untracked = dirty.length - modified.length
  const state: string[] = []
  if (branch !== "dev") state.push(`⚠ primary checkout is on '${branch}', not dev — localhost:3001 is not showing dev.`)
  if (ahead > 0) {
    const subjects = run(["log", "--format=%h %s", "-5", "origin/dev..dev"], primary).split("\n").filter(Boolean)
    state.push(
      `⚠ local dev has ${ahead} commit(s) that are NOT on origin/dev (invisible to new worktrees; do not add to them — that work ships via PR, then the primary is realigned with the user's OK):`,
      ...subjects.map((subject) => `  ${subject}`),
    )
  }
  if (modified.length > 0) {
    state.push(
      `⚠ ${modified.length} modified file(s) in the primary checkout — another session's work; do not touch, stash or commit them:`,
      ...modified.slice(0, 5).map((line) => `  ${line}`),
    )
  }
  if (untracked > 0) state.push(`${untracked} untracked path(s) in the primary checkout (leave them alone).`)
  if (ahead === 0 && behind > 0) {
    state.push(
      dirty.length === 0
        ? `local dev is ${behind} commit(s) behind origin/dev — safe to update localhost:3001: git -C ${primary} merge --ff-only origin/dev`
        : `local dev is ${behind} commit(s) behind origin/dev; fast-forward once the uncommitted changes above are gone.`,
    )
  }
  if (state.length > 0) lines.push("", "Primary checkout:", ...state)
})

type PrState = { number: number; state: string; isDraft: boolean; title: string; baseRefName: string; mergedAt: string | null }
const prs = new Map<string, PrState>()
attempt(() => {
  const list = JSON.parse(
    run(["pr", "list", "--state", "all", "--limit", "60", "--json", "number,state,isDraft,title,headRefName,baseRefName,mergedAt"], root, 10000, "gh"),
  ) as (PrState & { headRefName: string })[]
  for (const pr of list) if (!prs.has(pr.headRefName)) prs.set(pr.headRefName, pr)
  const open = list.filter((pr) => pr.state === "OPEN")
  if (open.length > 0) {
    lines.push("", "Open PRs:")
    for (const pr of open) lines.push(`  #${pr.number} ${pr.title} [${pr.headRefName} → ${pr.baseRefName}]${pr.isDraft ? " (draft)" : ""}`)
  }
})

const others = all.slice(1).filter((wt) => resolve(wt.path) !== resolve(here))
if (others.length > 0) {
  lines.push("", "Other worktrees (belong to other sessions — never modify, merge, clean up or remove them):")
  for (const wt of others) {
    const info = attempt(() => {
      const ref = wt.branch ?? "HEAD"
      const unmerged = Number(run(["rev-list", "--count", `origin/dev..${ref}`], wt.path))
      const dirty = run(["status", "--porcelain"], wt.path).split("\n").filter(Boolean).length
      const [age, committedAt] = run(["log", "-1", "--format=%cr%n%cI", ref], wt.path).split("\n")
      const pr = wt.branch ? prs.get(wt.branch) : undefined
      const mergedAfterTip = pr?.mergedAt ? Date.parse(committedAt) <= Date.parse(pr.mergedAt) : false
      const prNote = !pr
        ? ", no PR"
        : pr.state === "OPEN"
          ? `, PR #${pr.number} open`
          : pr.state === "MERGED" && !mergedAfterTip
            ? `, has commits after its PR #${pr.number} merged — no open PR for them`
            : `, PR #${pr.number} ${pr.state.toLowerCase()}`
      const leftover = mergedAfterTip && dirty === 0 ? " — fully merged; leftover for its owner to remove" : ""
      return `${unmerged} commit(s) ahead of origin/dev, ${dirty} uncommitted, last commit ${age}${prNote}${leftover}`
    })
    lines.push(`  ${wt.path} [${wt.branch ?? "detached"}]${info ? ` — ${info}` : ""}`)
  }
}

if (resolve(here) !== resolve(primary)) {
  lines.push("", `This session runs inside the worktree ${here} — work only here; the primary checkout is ${primary}.`)
}

console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: lines.join("\n") } }))
