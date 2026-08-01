import { expect, test } from "bun:test"
import { mergePartAttributeOptions } from "@/lib/parts/attributes"

test("atölye değerlerini katalog değerlerinden önce ve tekilleştirilmiş döndürür", () => {
  expect(
    mergePartAttributeOptions(
      ["  Filtre ", "Motor", ""],
      ["fİLTRE", "Fren", " Motor "]
    )
  ).toEqual(["Filtre", "Motor", "Fren"])
})

test("yalnız boşluk içeren değerleri önermez", () => {
  expect(mergePartAttributeOptions(["", "   "])).toEqual([])
})
