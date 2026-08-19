import { describe, expect, test } from "bun:test"
import { personnelName, technicianRoleForUser } from "./personnel"

describe("personnel role synchronization", () => {
  test("maps user roles to technician history roles", () => {
    expect(technicianRoleForUser("owner")).toBe("yonetici")
    expect(technicianRoleForUser("manager")).toBe("servis_danismani")
    expect(technicianRoleForUser("usta")).toBe("usta")
    expect(technicianRoleForUser("cirak")).toBe("cirak")
    expect(technicianRoleForUser("staff")).toBe("usta")
  })

  test("uses identity as fallback when a name is missing", () => {
    expect(personnelName("Ayşe", "Yılmaz", "ayse")).toBe("Ayşe Yılmaz")
    expect(personnelName(null, null, "ayse")).toBe("ayse")
  })
})
