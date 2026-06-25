#!/usr/bin/env node
/**
 * release.mjs — main-push deploy modelinde bir sürümü "damgalar" ve yayına alır.
 *
 * Deploy artık `v*` tag'iyle değil, `main`'e push ile tetikleniyor
 * (.github/workflows/deploy.yml + docs/RELEASE-FLOW.md). Bu yüzden "release" =
 * package.json sürümünü artır → main'e commit/push → prod otomatik deploy olur.
 * Tag (`vX.Y.Z`) yalnızca kayıt amaçlı atılır; tek başına deploy TETİKLEMEZ.
 *
 * Kullanım:
 *   npm run release            # patch (0.5.16 -> 0.5.17)
 *   npm run release -- minor   # 0.5.16 -> 0.6.0
 *   npm run release -- major   # 0.5.16 -> 1.0.0
 *   npm run release -- 0.7.3   # tam sürüm belirt
 *
 * Güvenlik kapıları: yalnızca `main`'de, temiz çalışma ağacında ve origin/main ile
 * güncelken çalışır; push'tan ÖNCE onay sorar (push = production deploy).
 */
import { readFileSync, writeFileSync } from "node:fs"
import { execSync } from "node:child_process"
import { createInterface } from "node:readline"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const PKG = join(ROOT, "package.json")

const out = (cmd) => execSync(cmd, { cwd: ROOT, encoding: "utf8" }).trim()
const run = (cmd) => execSync(cmd, { cwd: ROOT, stdio: "inherit" })
const die = (msg) => {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`)
  process.exit(1)
}

// 1) Güvenlik kapıları --------------------------------------------------------
const branch = out("git rev-parse --abbrev-ref HEAD")
if (branch !== "main") die(`release yalnızca 'main' üzerinde çalışır (şu an: ${branch}).`)

if (out("git status --porcelain")) {
  die("çalışma ağacı temiz değil — önce commit'le veya stash'le.")
}

run("git fetch origin main --quiet")
if (out("git rev-list --count HEAD..origin/main") !== "0") {
  die("local main, origin/main'in gerisinde — önce `git pull --ff-only` yap.")
}

// 2) Sıradaki sürümü hesapla ---------------------------------------------------
const pkg = JSON.parse(readFileSync(PKG, "utf8"))
const current = pkg.version
const arg = (process.argv[2] || "patch").trim()

function bump(version, kind) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (!m) die(`package.json sürümü semver değil: ${version}`)
  let [major, minor, patch] = m.slice(1).map(Number)
  if (kind === "patch") patch += 1
  else if (kind === "minor") { minor += 1; patch = 0 }
  else if (kind === "major") { major += 1; minor = 0; patch = 0 }
  else die(`geçersiz bump türü: ${kind}`)
  return `${major}.${minor}.${patch}`
}

const next = /^\d+\.\d+\.\d+$/.test(arg) ? arg : bump(current, arg)
const tag = `v${next}`

if (out("git tag --list " + tag)) die(`tag zaten var: ${tag}`)

console.log(`\nSürüm: \x1b[1m${current}\x1b[0m → \x1b[1m${next}\x1b[0m  (tag ${tag})`)

// 3) Onay (push = production deploy) ------------------------------------------
const rl = createInterface({ input: process.stdin, output: process.stdout })
const ans = await new Promise((res) =>
  rl.question(
    `\n\x1b[33mmain'e push edilecek ve production'a deploy olacak.\x1b[0m Devam? (y/N) `,
    res,
  ),
)
rl.close()
if (!/^y(es)?$/i.test(ans.trim())) die("iptal edildi.")

// 4) Bump → commit → tag → push -----------------------------------------------
pkg.version = next
writeFileSync(PKG, JSON.stringify(pkg, null, 2) + "\n")

run("git add package.json")
run(`git commit -m "chore: bump version to ${next}"`)
// Annotated tag — yalnızca sürüm kaydı; deploy'u main push'u tetikler, tag değil.
run(`git tag -a ${tag} -m "${tag} (sürüm kaydı; deploy main-push ile)"`)
run("git push origin main --follow-tags")

console.log(
  `\n\x1b[32m✓ ${tag} yayınlandı.\x1b[0m main push'u 'Deploy to Production' workflow'unu tetikledi.\n` +
    `  İzlemek için: gh run watch --workflow="Deploy to Production"`,
)
