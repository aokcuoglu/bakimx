import { describe, expect, test } from "bun:test"
import { createWorkshopTeamSchema } from "./workshop-team"

describe("createWorkshopTeamSchema", () => {
  test("accepts and trims a valid team name", () => {
    expect(createWorkshopTeamSchema.parse({ name: "  Ustalar  ", description: "Servis ekibi" })).toEqual({
      name: "Ustalar",
      description: "Servis ekibi",
    })
  })

  test("rejects names and descriptions outside the server limits", () => {
    expect(createWorkshopTeamSchema.safeParse({ name: "A", description: "" }).success).toBe(false)
    expect(createWorkshopTeamSchema.safeParse({ name: "A".repeat(41), description: "" }).success).toBe(false)
    expect(createWorkshopTeamSchema.safeParse({ name: "Usta", description: "A".repeat(161) }).success).toBe(false)
  })
})
