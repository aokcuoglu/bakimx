#!/usr/bin/env bun
// Claude Code PreToolUse hook for Bash: keeps git/gh/docker/db commands inside the BakımX flow
// (docs/harness/README.md, docs/agent-workflows/issue-delivery.md).
//   deny → commands that are never part of the flow (commit on dev/main, --no-verify, blind force
//          push, a non-fast-forward merge into local dev, wiping docker volumes)
//   ask  → commands the flow allows only with the user's explicit approval (anything that changes
//          main — merging into main deploys production —, version tags, deploy workflows, a direct
//          push to dev, resets in the primary checkout, writes to the shared AWS dev database)
// Everything else, including `gh pr merge` of a PR whose base is dev, passes untouched.
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { isAbsolute, join } from "node:path"

export interface GuardEnv {
  cwd: string
  branchAt: (dir: string) => string | null
  prBase: (dir: string, pr: string | undefined) => string | null
}

export interface Verdict {
  deny: string[]
  ask: string[]
}

export function branchAt(dir: string): string | null {
  try {
    return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  } catch {
    return null
  }
}

function prBase(dir: string, pr: string | undefined): string | null {
  try {
    const args = ["pr", "view", ...(pr ? [pr] : []), "--json", "baseRefName", "-q", ".baseRefName"]
    return execFileSync("gh", args, {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 8000,
    }).trim()
  } catch {
    return null
  }
}

const MAIN_REF = /(?:^|[\s:/])main(?=\s|$)/
const DEV_REF = /(?:^|[\s:/])dev(?=\s|$)/
const LOCAL_DB_URL = /(?:^|\s)DATABASE_URL=["']?postgres(?:ql)?:\/\/[^@\s]*@(?:localhost|127\.0\.0\.1):(?!5433\b)\d+/

const INTEGRATION =
  "local dev must stay a fast-forward of origin/dev (the only integration point) — integrate through a PR, then `git merge --ff-only origin/dev`"

/** Classify a shell command. `env` is injectable for tests. */
export function classify(command: string, env: GuardEnv): Verdict {
  const deny: string[] = []
  const ask: string[] = []
  let dir = env.cwd
  const resolveDir = (path: string) => (isAbsolute(path) ? path : join(dir, path))

  for (const raw of command.split(/&&|\|\||;|\||\n/)) {
    const original = raw.trim()
    const segment = original.replace(/^(?:\w+=\S*\s+)*/, "")
    const cd = segment.match(/^cd\s+(["']?)([^"']+)\1$/)
    if (cd) {
      dir = resolveDir(cd[2].trim())
      continue
    }

    const gitCmd = segment.match(/^git\s+(?:-C\s+(["']?)([^"'\s]+)\1\s+)?(\S+)(.*)$/)
    if (gitCmd) {
      const target = gitCmd[2] ? resolveDir(gitCmd[2]) : dir
      const sub = gitCmd[3]
      const rest = gitCmd[4]
      const branch = env.branchAt(target)
      const onShared = branch === "dev" || branch === "main"

      if (sub === "commit") {
        if (onShared) {
          deny.push(`committing on ${branch} — commit on an issue/<N>-<slug> worktree branch (../bakimx-<N>)`)
        }
        if (/--no-verify|(?:^|\s)-n(?:\s|$)/.test(rest)) deny.push("git commit --no-verify skips the repository's hooks")
      }
      if (sub === "push") {
        if (/--force(?!-with-lease)|(?:^|\s)-f(?:\s|$)/.test(rest)) {
          deny.push("force push without lease — use --force-with-lease on your own branch")
        }
        if (/--no-verify/.test(rest)) deny.push("git push --no-verify skips the pre-push hook that blocks direct pushes to dev/main")
        const bare = rest.replace(/\s-{1,2}[\w-]+(?:=\S+)?/g, " ").trim()
        const isDelete = /--delete|(?:^|\s):\S/.test(rest)
        const implicitTarget = !/\S+\s+\S+/.test(bare)
        if (!isDelete && (MAIN_REF.test(` ${bare}`) || /--all|--mirror/.test(rest) || (branch === "main" && implicitTarget))) {
          ask.push("push to main — main deploys production (deploy-prod-aws.yml); only an approved, versioned release")
        } else if (!isDelete && (DEV_REF.test(` ${bare}`) || (branch === "dev" && implicitTarget))) {
          ask.push("direct push to dev — dev changes go through a PR (pr-origin blocks shipping PR-less commits)")
        }
        if (/--tags|(?:^|\s|\/)v\d+\.\d+\.\d+/.test(rest)) ask.push("pushing a version tag — only for an approved main release")
      }
      if (sub === "tag" && /(?:^|\s)v\d+\.\d+\.\d+/.test(rest) && !/(?:^|\s)(?:-l|--list|-v|--verify|-n\d*)(?:\s|$)/.test(rest)) {
        ask.push("creating a version tag — only on the approved main release commit")
      }
      if (sub === "merge" && !/--ff-only|--abort|--continue|--quit/.test(rest)) {
        if (branch === "main") deny.push("merging into main locally — main changes only through the approved dev → main release PR")
        if (branch === "dev") deny.push(`merging into local dev — ${INTEGRATION}`)
      }
      if (sub === "pull" && onShared && !/--ff-only/.test(rest)) {
        deny.push(`git pull on ${branch} without --ff-only — ${INTEGRATION}`)
      }
      if (sub === "reset" && /--hard/.test(rest) && onShared) {
        ask.push(`git reset --hard on ${branch} — discards commits/changes in the primary checkout; only to realign it with origin/dev, with the user's OK`)
      }
      if (sub === "stash" && onShared && !/^\s*(?:list|show)\b/.test(rest)) {
        ask.push("git stash in the primary checkout — hides another session's uncommitted work")
      }
      if ((sub === "checkout" || sub === "restore") && /(?:^|\s)(?:--\s+)?\.(?:\s|$)/.test(rest)) {
        ask.push(`git ${sub} … . — overwrites every tracked file in this checkout`)
      }
      if (sub === "clean" && /(?:^|\s)-\w*f/.test(rest)) {
        ask.push("git clean -f — deletes untracked files (other sessions' artifacts in the primary checkout)")
      }
      if (sub === "worktree" && /^\s*remove\b/.test(rest) && /(?:^|\s)(?:--force|-f)(?:\s|$)/.test(rest)) {
        ask.push("git worktree remove --force — throws away that worktree's uncommitted work; remove only your own, clean worktree")
      }
      continue
    }

    const merge = segment.match(/^gh\s+pr\s+merge\b(.*)$/)
    if (merge) {
      if (/--admin\b/.test(merge[1])) deny.push("gh pr merge --admin bypasses branch protection — never use admin bypass")
      const pr = merge[1].split(/\s+/).find((arg) => arg && !arg.startsWith("-"))
      const base = env.prBase(dir, pr)
      if (base !== "dev") {
        ask.push(`gh pr merge (base: ${base ?? "unknown"}) — only PRs into dev merge without approval; merging into main deploys production`)
      }
      continue
    }
    if (/^gh\s+api\b/.test(segment) && /\/merges\b|git\/refs\/heads\/(?:main|dev)\b|pulls\/\d+\/merge|git\/refs\/tags/.test(segment)) {
      ask.push("gh api merge/ref change — treated like a change to main/dev")
      continue
    }
    if (/^gh\s+(?:workflow\s+run|run\s+rerun)\b/.test(segment)) {
      ask.push("dispatching or re-running a workflow can deploy app-dev/app.bakimx.com — needs the user's explicit OK")
      continue
    }
    if (/^gh\s+release\s+create\b/.test(segment)) {
      ask.push("GitHub Release — only for an approved main release")
      continue
    }
    if (/^gh\s+repo\s+edit\b/.test(segment) && /--visibility|--default-branch|--delete-branch-on-merge/.test(segment)) {
      ask.push("changing repository settings — needs the user's explicit OK")
      continue
    }

    if (/^docker(?:\s+compose|-compose)\b/.test(segment) && /\sdown\b/.test(segment) && /(?:^|\s)(?:-v|--volumes)(?:\s|$)/.test(segment)) {
      deny.push("docker compose down -v wipes database volumes — use ./scripts/local-reset.sh (AGENTS.md → Local Infrastructure)")
      continue
    }
    if (/^docker\s+(?:volume|system)\s+prune\b/.test(segment)) {
      deny.push("docker prune removes other sessions' and projects' volumes — remove only named resources you created")
      continue
    }
    if (/^docker\s+volume\s+rm\b/.test(segment)) {
      ask.push("docker volume rm — make sure the volume is yours (parallel sessions and other projects share this Docker)")
      continue
    }

    if (/^(?:\.\/)?scripts\/local-reset\.sh\b|(?:^|\s)prisma\s+migrate\s+reset\b|(?:^|\s)prisma\s+db\s+push\b|^bun\s+run\s+db:push\b/.test(segment)) {
      ask.push("resets or pushes a database schema directly — confirm which database (.env.local points at the shared AWS dev DB)")
      continue
    }
    if (/^bun\s+run\s+db:prod-reset\b/.test(segment) && /--execute|--apply|--yes/.test(segment)) {
      ask.push("production tenant data reset — irreversible, needs the user's explicit OK and an RDS snapshot")
      continue
    }
    if (/(?:^bun\s+run\s+db:deploy\b|(?:^|\s)prisma\s+migrate\s+deploy\b)/.test(segment) && !LOCAL_DB_URL.test(original)) {
      ask.push(
        "migrate deploy against .env.local applies this branch's migrations to the shared AWS dev DB (app-dev + every session) — for branch QA pass an isolated DATABASE_URL (docs/harness/README.md)",
      )
    }
  }
  return { deny, ask }
}

function main(): void {
  let input: { tool_input?: { command?: string }; cwd?: string }
  try {
    input = JSON.parse(readFileSync(0, "utf8"))
  } catch {
    process.exit(0)
  }
  const command = input.tool_input?.command ?? ""
  if (!/\b(?:git|gh|docker|docker-compose|prisma|bun|scripts\/local-reset)\b/.test(command)) process.exit(0)
  const { deny, ask } = classify(command, { cwd: input.cwd ?? process.cwd(), branchAt, prBase })
  if (deny.length === 0 && ask.length === 0) process.exit(0)

  const decision = deny.length > 0 ? "deny" : "ask"
  const reasons = deny.length > 0 ? deny : ask
  const reason = `BakımX flow guard (docs/harness/README.md):\n- ${[...new Set(reasons)].join("\n- ")}`
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision, permissionDecisionReason: reason },
    }),
  )
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) main()
