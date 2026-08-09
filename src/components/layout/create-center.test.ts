import { expect, test } from "bun:test"
import { CREATE_OPTIONS } from "@/components/layout/create-center"

test("oluşturma merkezi dört mevcut oluşturma rotasını korur", () => {
  expect(CREATE_OPTIONS.map((option) => option.href)).toEqual([
    "/orders/new",
    "/quotes/new",
    "/appointments/new",
    "/reminders/new",
  ])
})

test("oluşturma seçeneklerinin erişilebilir adları benzersizdir", () => {
  const titles = CREATE_OPTIONS.map((option) => option.title)
  expect(new Set(titles).size).toBe(titles.length)
  expect(CREATE_OPTIONS.every((option) => option.description.length > 0)).toBe(true)
})

