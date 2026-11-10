"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import { requireWritableFeatureWorkshop } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { assertCanManageTeam } from "@/lib/rbac"
import { PERMISSIONS, actorCan, parsePermissions } from "@/lib/roles"

type Result = { ok: true; id?: string } | { ok: false; error: string }

const nameSchema = z.string().trim().min(2, "Ekip adı en az 2 karakter.").max(40, "Ekip adı en fazla 40 karakter.")

function revalidateTeams() {
  revalidatePath("/settings/members-and-teams/teams")
  revalidatePath("/settings/members-and-teams/members")
}

export async function saveWorkshopTeamAction(input: {
  id?: string
  name: string
  description: string
  permissions: string[]
}): Promise<Result> {
  const { user } = await requireWritableFeatureWorkshop("team.manage", "team")
  try {
    assertCanManageTeam(user)
    const name = nameSchema.safeParse(input.name)
    if (!name.success) return { ok: false, error: name.error.issues[0]?.message ?? "Geçersiz ekip adı." }
    const permissions = parsePermissions(input.permissions)
    if (permissions.length !== new Set(input.permissions).size || input.permissions.some((p) => !PERMISSIONS.includes(p as never))) {
      return { ok: false, error: "Listede olmayan bir yetki seçildi." }
    }
    if (permissions.some((permission) => !actorCan(user, permission))) {
      return { ok: false, error: "Kendi yetkiniz dışında bir yetki veremezsiniz." }
    }
    const description = input.description.trim().slice(0, 160) || null

    let id = input.id
    if (id) {
      const existing = await prisma.workshopTeam.findFirst({
        where: { id, workshopId: user.workshopId },
        select: { id: true },
      })
      if (!existing) return { ok: false, error: "Ekip bulunamadı." }
      await prisma.workshopTeam.update({
        where: { id: existing.id },
        data: { name: name.data, description, permissions },
      })
    } else {
      const created = await prisma.workshopTeam.create({
        data: {
          workshopId: user.workshopId,
          name: name.data,
          description,
          permissions,
        },
        select: { id: true },
      })
      id = created.id
    }
    await AuditLogAction(
      user.workshopId,
      user.id,
      "WorkshopTeam",
      id ?? "new",
      input.id ? "team_updated" : "team_created",
      JSON.stringify({ name: name.data, permissions }),
    )
    revalidateTeams()
    return { ok: true, id }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ekip kaydedilemedi."
    if (message.includes("Unique constraint")) return { ok: false, error: "Bu ekip adı zaten var." }
    return { ok: false, error: message }
  }
}

export async function deleteWorkshopTeamAction(id: string): Promise<Result> {
  const { user } = await requireWritableFeatureWorkshop("team.manage", "team")
  try {
    assertCanManageTeam(user)
    const team = await prisma.workshopTeam.findFirst({
      where: { id, workshopId: user.workshopId },
      select: { id: true, _count: { select: { members: true } } },
    })
    if (!team) return { ok: false, error: "Ekip bulunamadı." }
    if (team._count.members > 0) return { ok: false, error: "Ekibi silmeden önce üyelerini taşıyın." }
    await prisma.workshopTeam.delete({ where: { id: team.id } })
    revalidateTeams()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Ekip silinemedi." }
  }
}

export async function addTeamMembersAction(teamId: string, userIds: string[]): Promise<Result> {
  const { user } = await requireWritableFeatureWorkshop("team.manage", "team")
  try {
    assertCanManageTeam(user)
    const team = await prisma.workshopTeam.findFirst({
      where: { id: teamId, workshopId: user.workshopId },
      select: { id: true },
    })
    if (!team) return { ok: false, error: "Ekip bulunamadı." }
    const ids = [...new Set(userIds)].filter((id) => id !== user.id)
    if (ids.length === 0) return { ok: false, error: "Eklenecek üye seçin." }
    await prisma.user.updateMany({
      where: { id: { in: ids }, workshopId: user.workshopId, role: { not: "owner" } },
      data: { teamId: team.id },
    })
    revalidateTeams()
    return { ok: true, id: team.id }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Üyeler eklenemedi." }
  }
}

export async function removeTeamMemberAction(teamId: string, userId: string): Promise<Result> {
  const { user } = await requireWritableFeatureWorkshop("team.manage", "team")
  try {
    assertCanManageTeam(user)
    if (userId === user.id) return { ok: false, error: "Kendinizi ekipten çıkaramazsınız." }
    const target = await prisma.user.findFirst({
      where: { id: userId, workshopId: user.workshopId, teamId },
      select: { id: true },
    })
    if (!target) return { ok: false, error: "Üye bu ekipte değil." }
    await prisma.user.update({ where: { id: target.id }, data: { teamId: null } })
    revalidateTeams()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Üye çıkarılamadı." }
  }
}
