import { expect, test } from "bun:test"
import { dataUrlToBlob } from "@/lib/image/data-url"

test("dataUrlToBlob: base64 veriyi tip ve baytlarıyla çözer", async () => {
  const blob = dataUrlToBlob(`data:image/jpeg;base64,${btoa("abc")}`)
  expect(blob?.type).toBe("image/jpeg")
  expect(await blob?.text()).toBe("abc")
})

test("dataUrlToBlob: geçersiz girdide null", () => {
  expect(dataUrlToBlob("not-a-data-url")).toBeNull()
  expect(dataUrlToBlob("data:image/png;base64,***")).toBeNull()
})
