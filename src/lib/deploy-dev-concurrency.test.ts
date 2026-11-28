import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

// #1075 — only runs that deploy may share the `aws-dev-deploy` concurrency group.
// GitHub keeps one pending run per group and a newly queued run cancels it, so an
// unmarked push sharing the group silently cancelled a queued `[deploy-dev]` run.
const workflow = readFileSync(join(process.cwd(), ".github/workflows/deploy-dev-aws.yml"), "utf8")

const MARKER_CONDITION =
  "github.event_name == 'workflow_dispatch' || contains(github.event.head_commit.message, '[deploy-dev]')"

describe("deploy-dev-aws concurrency (#1075)", () => {
  test("the concurrency group is keyed on the same opt-in condition as the jobs", () => {
    const group = workflow.match(/^concurrency:\n {2}group: (.+)$/m)?.[1]
    expect(group).toBe(
      `\${{ (${MARKER_CONDITION}) && 'aws-dev-deploy' || format('aws-dev-skip-{0}', github.run_id) }}`,
    )
  })

  test("every job-level opt-in `if` uses exactly that condition", () => {
    const jobIfs = [...workflow.matchAll(/^ {4}if: (.+)$/gm)].map((m) => m[1])
    expect(jobIfs.length).toBeGreaterThanOrEqual(2) // pr-origin + quality; deploy needs both
    for (const cond of jobIfs) expect(cond).toBe(`\${{ ${MARKER_CONDITION} }}`)
  })

  test("queued deploys are never cancelled mid-flight", () => {
    expect(workflow).toMatch(/^ {2}cancel-in-progress: false$/m)
  })
})
