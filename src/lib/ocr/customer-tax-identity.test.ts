import { describe, expect, test } from "bun:test"
import { classifyCustomerTaxIdentity } from "./customer-tax-identity"

describe("classifyCustomerTaxIdentity", () => {
  test("11 haneli değeri T.C. kimlik numarası olarak ayırır", () => {
    expect(classifyCustomerTaxIdentity("123 456 789 01")).toEqual({
      identityNumber: "12345678901",
      taxNumber: null,
    })
  })

  test("10 haneli değeri vergi numarası olarak ayırır", () => {
    expect(classifyCustomerTaxIdentity("123-456-7890")).toEqual({
      identityNumber: null,
      taxNumber: "1234567890",
    })
  })

  test("diğer uzunlukları müşteri ek bilgilerine taşımaz", () => {
    expect(classifyCustomerTaxIdentity("123456789")).toEqual({
      identityNumber: null,
      taxNumber: null,
    })
  })
})
