import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dir, "../..")

test("optional demo Ads destinations reach the browser build through the dev pipeline", () => {
  const builder = readFileSync(join(root, "Dockerfile"), "utf8").split("RUN npm run build")[0]
  const workflow = readFileSync(join(root, ".github/workflows/deploy-dev-aws.yml"), "utf8")
  const buildArgs = workflow.split("build-args: |")[1]?.split(/\n\s*- name:/)[0]
  const requiredAnalyticsValidation = workflow.split("- name: Validate analytics build configuration")[1]?.split("- name: Build & push")[0]
  for (const suffix of ["ID", "LABEL"]) {
    const name = `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_${suffix}`
    expect(builder).toContain(`ARG ${name}=\n`)
    expect(builder).toContain(`ENV ${name}=$${name}`)
    expect(buildArgs).toContain(`${name}=\${{ vars.DEV_${name} }}`)
    expect(requiredAnalyticsValidation).not.toContain(name)
  }
})
