import { describe, expect, test } from "bun:test"
import {
  canCompleteWork,
  canHoldWork,
  workPrimaryAction,
  workScreenPermissions,
  workScreenTiles,
} from "./work-screen"

const usta = workScreenPermissions({ role: "usta" }, true)
const staff = workScreenPermissions({ role: "staff" }, true)
const cirak = workScreenPermissions({ role: "cirak" }, true)

describe("workScreenPermissions — procurement özelliği", () => {
  test("özellik yoksa parts.purchase olsa da Dış Parça görünmez", () => {
    const noFeature = workScreenPermissions({ role: "usta" }, false)
    expect(noFeature.canPurchase).toBe(false)
    expect(workScreenTiles(noFeature, false)).not.toContain("purchase")
  })

  test("özellik var ama izin yoksa da görünmez", () => {
    expect(workScreenPermissions({ role: "cirak", teamPermissions: [] }, true).canPurchase).toBe(false)
  })
})

describe("workScreenTiles", () => {
  test("usta ve staff altı kutucuğu sırayla görür", () => {
    const all = ["part", "labor", "purchase", "externalLabor", "photo", "note"]
    expect(workScreenTiles(usta, false)).toEqual(all)
    expect(workScreenTiles(staff, false)).toEqual(all)
  })

  test("çırak yalnız Dış Parça ve Fotoğraf görür", () => {
    expect(workScreenTiles(cirak, false)).toEqual(["purchase", "photo"])
  })

  test("kilitli işte kutucuk yok", () => {
    expect(workScreenTiles(usta, true)).toEqual([])
  })

  test("yetkiler roleCan matrisinden türer", () => {
    expect(cirak).toEqual({ canEditOrder: false, canChangeStatus: false, canPurchase: true, canAddPhoto: true })
    expect(usta.canChangeStatus).toBe(true)
  })
})

describe("workPrimaryAction", () => {
  test("durum -> eylem tablosu", () => {
    for (const s of ["draft", "waiting_approval", "approved", "waiting_parts"]) {
      expect(workPrimaryAction(s, false, true)).toBe("start")
    }
    expect(workPrimaryAction("in_progress", false, true)).toBe("resume")
    expect(workPrimaryAction("in_progress", true, true)).toBe("pause")
    expect(workPrimaryAction("ready_for_delivery", false, true)).toBeNull()
    expect(workPrimaryAction("delivered", false, true)).toBeNull()
    expect(workPrimaryAction("cancelled", false, true)).toBeNull()
  })

  test("açık sayaç olsa da kilitli iş ve teslime hazır iş eylemsiz", () => {
    expect(workPrimaryAction("delivered", true, true)).toBeNull()
    expect(workPrimaryAction("ready_for_delivery", true, true)).toBeNull()
  })

  test("order.status yoksa hep null", () => {
    for (const s of ["draft", "in_progress", "waiting_parts"]) {
      expect(workPrimaryAction(s, false, false)).toBeNull()
      expect(workPrimaryAction(s, true, false)).toBeNull()
    }
  })
})

describe("Parça bekliyor / İşi Bitir kapıları", () => {
  test("Parça bekliyor yalnız Serviste", () => {
    expect(canHoldWork("in_progress", true)).toBe(true)
    expect(canHoldWork("waiting_parts", true)).toBe(false)
    expect(canHoldWork("draft", true)).toBe(false)
    expect(canHoldWork("in_progress", false)).toBe(false)
  })

  test("İşi Bitir yalnız Serviste ve Parça Bekliyor'da", () => {
    expect(canCompleteWork("in_progress", true)).toBe(true)
    expect(canCompleteWork("waiting_parts", true)).toBe(true)
    expect(canCompleteWork("draft", true)).toBe(false)
    expect(canCompleteWork("ready_for_delivery", true)).toBe(false)
    expect(canCompleteWork("in_progress", false)).toBe(false)
  })
})
