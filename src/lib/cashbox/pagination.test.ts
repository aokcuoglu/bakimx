import { describe, expect, test } from "bun:test"
import { computeCollectionPage, parsePageParam } from "./pagination"

describe("parsePageParam", () => {
  test("geçersiz girdi 1'e düşer", () => {
    expect(parsePageParam(undefined)).toBe(1)
    expect(parsePageParam("abc")).toBe(1)
    expect(parsePageParam("0")).toBe(1)
    expect(parsePageParam("-3")).toBe(1)
    expect(parsePageParam("4")).toBe(4)
  })
})

describe("computeCollectionPage", () => {
  test("offset ve aralık", () => {
    expect(computeCollectionPage(2, 60, 25)).toEqual({ page: 2, pageCount: 3, offset: 25, from: 26, to: 50 })
    expect(computeCollectionPage(3, 60, 25)).toMatchObject({ offset: 50, from: 51, to: 60 })
  })
  test("fazla sayfa son sayfaya kırpılır", () => {
    expect(computeCollectionPage(99, 60, 25).page).toBe(3)
  })
  test("kayıt yok", () => {
    expect(computeCollectionPage(1, 0, 25)).toEqual({ page: 1, pageCount: 1, offset: 0, from: 0, to: 0 })
  })
  test("toplam sayfadan bağımsızdır", () => {
    expect(computeCollectionPage(1, 201, 25).pageCount).toBe(computeCollectionPage(9, 201, 25).pageCount)
  })
})
