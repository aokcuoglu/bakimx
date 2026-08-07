import { expect, test } from "bun:test"
import { resolveLaborUniqueMessage } from "./labor-actions"

const CODE_TAKEN = "Bu işçilik kodu zaten kullanılıyor"
const NAME_TAKEN = "Bu isimde bir işçilik zaten var"

test("kod boş + ad çakışıyor → NAME_TAKEN", async () => {
  const message = await resolveLaborUniqueMessage({
    codeProvided: false,
    codeConflict: false,
    nameConflict: true,
  })
  expect(message).toBe(NAME_TAKEN)
})

test("kod dolu + kod çakışıyor → CODE_TAKEN", async () => {
  const message = await resolveLaborUniqueMessage({
    codeProvided: true,
    codeConflict: true,
    nameConflict: false,
  })
  expect(message).toBe(CODE_TAKEN)
})

test("kod dolu ama yalnız ad çakışıyor → NAME_TAKEN", async () => {
  const message = await resolveLaborUniqueMessage({
    codeProvided: true,
    codeConflict: false,
    nameConflict: true,
  })
  expect(message).toBe(NAME_TAKEN)
})

test("kod dolu + hem kod hem ad çakışıyor → CODE_TAKEN önceliklidir", async () => {
  const message = await resolveLaborUniqueMessage({
    codeProvided: true,
    codeConflict: true,
    nameConflict: true,
  })
  expect(message).toBe(CODE_TAKEN)
})

test("P2002 fırladı ama iki bayrak da false (yarış durumu) → güvenli varsayılan NAME_TAKEN", async () => {
  const message = await resolveLaborUniqueMessage({
    codeProvided: true,
    codeConflict: false,
    nameConflict: false,
  })
  expect(message).toBe(NAME_TAKEN)
})
