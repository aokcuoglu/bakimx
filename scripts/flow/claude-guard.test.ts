import { describe, expect, test } from "bun:test"
import { classify, type GuardEnv } from "./claude-guard"

const env = (branches: Record<string, string> = {}, bases: Record<string, string> = {}): GuardEnv => ({
  cwd: "/repo",
  branchAt: (dir) => branches[dir] ?? "issue/1-x",
  prBase: (_dir, pr) => bases[pr ?? "current"] ?? null,
})
const decide = (command: string, e: GuardEnv = env()) => {
  const { deny, ask } = classify(command, e)
  return deny.length ? "deny" : ask.length ? "ask" : "allow"
}
const onDev = env({ "/repo": "dev" })

describe("claude-guard", () => {
  test("commits: allowed on a worktree branch, denied on dev/main or with --no-verify", () => {
    expect(decide('git commit -m "fix(#12): x"')).toBe("allow")
    expect(decide("git commit -m x", onDev)).toBe("deny")
    expect(decide("git -C /wt commit -m x", env({ "/wt": "main" }))).toBe("deny")
    expect(decide("cd /wt && git commit -m x", env({ "/wt": "dev" }))).toBe("deny")
    expect(decide("git commit --no-verify -m x")).toBe("deny")
  })

  test("pushes: own branch passes, main/dev/tags ask, blind force and --no-verify are denied", () => {
    expect(decide("git push -u origin issue/12-thing")).toBe("allow")
    expect(decide("git push --force-with-lease origin issue/12-thing")).toBe("allow")
    expect(decide("git push origin --delete issue/12-thing")).toBe("allow")
    expect(decide("git push origin issue/42-main-menu")).toBe("allow")
    expect(decide("git push origin main")).toBe("ask")
    expect(decide("git push origin HEAD:main")).toBe("ask")
    expect(decide("git push origin dev")).toBe("ask")
    expect(decide("git push", onDev)).toBe("ask")
    expect(decide("git push", env({ "/repo": "main" }))).toBe("ask")
    expect(decide("git push origin v0.19.0")).toBe("ask")
    expect(decide("git push --force origin issue/12-thing")).toBe("deny")
    expect(decide("ALLOW_DIRECT_PUSH=1 git push --no-verify origin dev")).toBe("deny")
  })

  test("local dev stays a fast-forward of origin/dev", () => {
    expect(decide("git merge --ff-only origin/dev", onDev)).toBe("allow")
    expect(decide("git pull --ff-only origin dev", onDev)).toBe("allow")
    expect(decide("git merge issue/12-thing", onDev)).toBe("deny")
    expect(decide("git merge origin/dev", onDev)).toBe("deny")
    expect(decide("git pull --no-rebase origin dev", onDev)).toBe("deny")
    expect(decide("git merge dev", env({ "/repo": "main" }))).toBe("deny")
    // Bringing origin/dev into a feature branch is the normal freshness step.
    expect(decide("git merge origin/dev")).toBe("allow")
    expect(decide("git pull")).toBe("allow")
  })

  test("destructive commands in the primary checkout ask", () => {
    expect(decide("git reset --hard origin/dev", onDev)).toBe("ask")
    expect(decide("git reset --hard HEAD~1")).toBe("allow")
    expect(decide("git stash", onDev)).toBe("ask")
    expect(decide("git stash list", onDev)).toBe("allow")
    expect(decide("git checkout main -- .")).toBe("ask")
    expect(decide("git checkout -- src/app/page.tsx")).toBe("allow")
    expect(decide("git clean -fd")).toBe("ask")
    expect(decide("git worktree remove --force ../bakimx-12")).toBe("ask")
    expect(decide("git worktree remove ../bakimx-12")).toBe("allow")
  })

  test("tags: listing is fine, creating a version tag asks", () => {
    expect(decide("git tag --sort=-v:refname")).toBe("allow")
    expect(decide("git tag -l v0.1*")).toBe("allow")
    expect(decide('git tag -a v0.19.0 -m "v0.19.0"')).toBe("ask")
  })

  test("gh pr merge: base dev passes, base main or unknown asks, --admin is denied", () => {
    expect(decide("gh pr merge 790 --squash", env({}, { 790: "dev" }))).toBe("allow")
    expect(decide("gh pr merge 791 --merge", env({}, { 791: "main" }))).toBe("ask")
    expect(decide("gh pr merge 792")).toBe("ask")
    expect(decide("gh pr merge 790 --squash --admin", env({}, { 790: "dev" }))).toBe("deny")
  })

  test("deploys, releases and repository settings ask", () => {
    expect(decide("gh workflow run deploy-dev-aws.yml --ref dev")).toBe("ask")
    expect(decide("gh run rerun 123 --failed")).toBe("ask")
    expect(decide("gh release create v0.19.0")).toBe("ask")
    expect(decide("gh api repos/o/r/merges -f base=main")).toBe("ask")
    expect(decide("gh repo edit --default-branch dev")).toBe("ask")
    expect(decide("gh run list --branch dev")).toBe("allow")
    expect(decide("gh pr checks 790 --watch")).toBe("allow")
    expect(decide("gh release view v0.18.0")).toBe("allow")
  })

  test("docker volumes: down -v and prune are denied", () => {
    expect(decide("docker compose -f docker-compose.local.yml down -v")).toBe("deny")
    expect(decide("docker compose -p bakimx-12 -f docker-compose.local.yml down --volumes")).toBe("deny")
    expect(decide("docker volume prune -f")).toBe("deny")
    expect(decide("docker system prune -a")).toBe("deny")
    expect(decide("docker volume rm bakimx-12_pgdata_local")).toBe("ask")
    expect(decide("docker compose -p bakimx-12 -f docker-compose.local.yml up -d")).toBe("allow")
    expect(decide("docker compose -p bakimx-12 -f docker-compose.local.yml down")).toBe("allow")
  })

  test("shared database: deploy/reset ask unless an isolated local URL is passed", () => {
    expect(decide("bun run db:deploy")).toBe("ask")
    expect(decide("bunx prisma migrate deploy")).toBe("ask")
    expect(
      decide(
        "DATABASE_URL=postgresql://bakimx:bakimx@localhost:5442/bakimx DIRECT_URL=postgresql://bakimx:bakimx@localhost:5442/bakimx bunx prisma migrate deploy",
      ),
    ).toBe("allow")
    expect(decide("DATABASE_URL=postgresql://bakimx:x@localhost:5433/bakimx bunx prisma migrate deploy")).toBe("ask")
    expect(decide("bun run db:push")).toBe("ask")
    expect(decide("bunx prisma migrate reset --force")).toBe("ask")
    expect(decide("./scripts/local-reset.sh")).toBe("ask")
    expect(decide("bun run db:prod-reset -- --execute")).toBe("ask")
    expect(decide("bun run db:prod-reset")).toBe("allow")
    expect(decide("bun run db:migrate --name add_widget")).toBe("allow")
    expect(decide("bun test")).toBe("allow")
  })
})
