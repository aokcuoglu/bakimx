import { expect, test } from "bun:test"
import { isUniqueConstraintError } from "./prisma-errors"

/**
 * Bu dosyanın varlık sebebi somut bir hata: kontrol yalnız `meta.target`'a
 * bakıyordu ve sürücü adaptörlü Prisma istemcisinde o alan BOŞ geliyor. Sonuç
 * sessizdi — çakışma hiç yakalanmıyor, kullanıcı ham Prisma metnini görüyordu.
 * Aşağıdaki ikinci şekil gerçek bir çalıştırmadan alındı.
 */

test("klasik şekil: meta.target alan listesi", () => {
  expect(isUniqueConstraintError({ code: "P2002", meta: { target: ["username"] } }, "username")).toBe(true)
  expect(isUniqueConstraintError({ code: "P2002", meta: { target: ["loginCode"] } }, "logincode")).toBe(true)
  expect(isUniqueConstraintError({ code: "P2002", meta: { target: ["email"] } }, "username")).toBe(false)
})

test("klasik şekil: meta.target kısıt adı", () => {
  expect(
    isUniqueConstraintError({ code: "P2002", meta: { target: "Workshop_loginCode_key" } }, "logincode")
  ).toBe(true)
})

test("sürücü adaptörü şekli: kısıt bilgisi driverAdapterError altında", () => {
  const error = {
    code: "P2002",
    meta: {
      modelName: "User",
      driverAdapterError: {
        name: "DriverAdapterError",
        cause: {
          originalCode: "23505",
          originalMessage:
            'duplicate key value violates unique constraint "User_workshopId_username_key"',
          kind: "UniqueConstraintViolation",
          constraint: { fields: ['"workshopId"', "username"] },
        },
      },
    },
  }
  expect(isUniqueConstraintError(error, "username")).toBe(true)
  expect(isUniqueConstraintError(error, "email")).toBe(false)
})

test("sürücü adaptörü şekli: yalnız index adı geldiğinde de eşleşir", () => {
  const error = {
    code: "P2002",
    meta: { driverAdapterError: { cause: { constraint: { index: "Workshop_loginCode_key" } } } },
  }
  expect(isUniqueConstraintError(error, "logincode")).toBe(true)
})

test("P2002 olmayan hiçbir şey benzersizlik ihlali sayılmaz", () => {
  expect(isUniqueConstraintError({ code: "P2025", meta: { target: ["username"] } }, "username")).toBe(false)
  expect(isUniqueConstraintError(new Error("boom"), "username")).toBe(false)
  expect(isUniqueConstraintError(null, "username")).toBe(false)
  expect(isUniqueConstraintError(undefined, "username")).toBe(false)
})
