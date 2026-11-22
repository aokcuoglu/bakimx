#!/usr/bin/env bun
// Claude Code PostToolUse hook (Edit|Write|MultiEdit): after a file under src/ changes, runs the
// source-scanning gate tests (`bun run harness:gates`, docs/agent-workflows/repo-guardrails.md §5)
// in the checkout the file belongs to, and hands failures back to the agent as context. Never
// blocks. The hook command points at $CLAUDE_PROJECT_DIR (often the primary checkout) while agents
// edit files in issue worktrees, so the checkout is taken from the edited file.
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, realpathSync } from "node:fs"
import { dirname, join, relative } from "node:path"

function exit(): never {
  process.exit(0)
}

let input: { tool_input?: { file_path?: string; path?: string } }
try {
  input = JSON.parse(readFileSync(0, "utf8"))
} catch {
  exit()
}
const filePath = input.tool_input?.file_path ?? input.tool_input?.path
if (!filePath) exit()

let absPath: string
try {
  absPath = realpathSync(filePath)
} catch {
  exit()
}

let root: string
try {
  root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: dirname(absPath),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim()
} catch {
  exit()
}

const rel = relative(root, absPath)
if (!rel.startsWith("src/") || !/\.(tsx?|css)$/.test(rel)) exit()

// A BakımX checkout that has the gate script and installed dependencies.
let scripts: Record<string, string> = {}
try {
  scripts = (JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { scripts?: Record<string, string> }).scripts ?? {}
} catch {
  exit()
}
if (!scripts["harness:gates"] || !existsSync(join(root, "node_modules"))) exit()

let out = ""
try {
  execFileSync("bun", ["run", "harness:gates"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 50_000 })
  exit()
} catch (error) {
  const failure = error as { stdout?: string; stderr?: string }
  out = `${failure.stdout ?? ""}${failure.stderr ?? ""}`
}

// bun prints the failing assertions and a summary; keep the tail so the context stays small.
const tail = out.trim().split("\n").slice(-60).join("\n")
const context = `BakımX source gates failed after editing ${rel} (the same tests CI runs — docs/agent-workflows/repo-guardrails.md §5; fix before moving on, never loosen the test):\n\n${tail}`
process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: context } }))
