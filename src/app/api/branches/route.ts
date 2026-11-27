import { NextResponse } from "next/server"
import { requireWritableFeatureWorkshop } from "@/lib/auth"
import { apiErrorResponse } from "@/lib/api-errors"
import { prisma } from "@/lib/db"
import {
  activateWorkshopForUser,
  ensureMembership,
  ensureWorkshopOrganization,
} from "@/lib/membership"
import { isLoginCodeConflict, workshopCodeCandidate } from "@/lib/workshop-code"
import { createBranchSchema } from "@/lib/validations/branch"
import { establishSession } from "@/lib/session"

const MAX_LOGIN_CODE_RETRIES = 5

export async function POST(request: Request) {
  try {
    const { user, workshop } = await requireWritableFeatureWorkshop(
      "settings.manage",
      "multiBranch",
    )
    if (user.impersonatorAdminId) {
      return NextResponse.json(
        { error: "Taklit modunda şube oluşturulamaz." },
        { status: 403 },
      )
    }
    if (user.role !== "owner") {
      return NextResponse.json(
        { error: "Yalnız iş yeri sahibi yeni şube oluşturabilir." },
        { status: 403 },
      )
    }

    const raw: unknown = await request.json()
    const parsed = createBranchSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Geçersiz şube bilgileri.", details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const data = parsed.data

    const source = await prisma.workshop.findUnique({
      where: { id: workshop.id },
      select: {
        id: true,
        name: true,
        organizationId: true,
        planTier: true,
        subscriptionStatus: true,
        approvalStatus: true,
        trialStartedAt: true,
        trialEndsAt: true,
        liteFreeGrantedAt: true,
        billingCycle: true,
        currentPeriodEnd: true,
        bakimxDiscountBps: true,
        extraSeats: true,
        extraVinQuota: true,
        addons: true,
        email: true,
        settings: {
          select: {
            weekdayStart: true,
            weekdayEnd: true,
            weekdayWorkingDays: true,
            weekendStart: true,
            weekendEnd: true,
            weekendWorkingDays: true,
          },
        },
      },
    })
    if (!source) {
      return NextResponse.json({ error: "Kaynak iş yeri bulunamadı." }, { status: 404 })
    }

    let created: { id: string; name: string; loginCode: string } | null = null

    for (let attempt = 0; attempt < MAX_LOGIN_CODE_RETRIES; attempt++) {
      const loginCode = workshopCodeCandidate(data.name, attempt)
      try {
        created = await prisma.$transaction(async (tx) => {
          const organizationId = await ensureWorkshopOrganization(
            source.id,
            source.name,
            source.organizationId,
            tx,
          )

          const branch = await tx.workshop.create({
            data: {
              loginCode,
              name: data.name,
              phone: data.phone,
              city: data.city,
              district: data.district || null,
              address: data.address,
              email: source.email,
              organizationId,
              planTier: source.planTier,
              subscriptionStatus: source.subscriptionStatus,
              approvalStatus: "approved",
              trialStartedAt: source.trialStartedAt,
              trialEndsAt: source.trialEndsAt,
              liteFreeGrantedAt: source.liteFreeGrantedAt,
              billingCycle: source.billingCycle,
              currentPeriodEnd: source.currentPeriodEnd,
              bakimxDiscountBps: source.bakimxDiscountBps,
              extraSeats: 0,
              extraVinQuota: 0,
              // Ek özellikler hesap başınadır (#829); yeni şube kaynağın açık ek
              // özelliklerini devralır. Katalog kotası hesap genelinde sayılır
              // (`resolveWorkshopQuotaContext`): extraVinQuota 0 kalır, toplam kapsar.
              addons: source.addons,
              onboardingProfile: {
                status: "completed",
                sector: data.sector,
                businessFeatures: data.businessFeatures,
                teamSize: data.teamSize,
                selectedModules: data.selectedModules,
                setupPreference: data.setupPreference,
              },
              settings: {
                create: {
                  weekdayStart: source.settings?.weekdayStart ?? "09:00",
                  weekdayEnd: source.settings?.weekdayEnd ?? "18:00",
                  weekdayWorkingDays: source.settings?.weekdayWorkingDays ?? "1,2,3,4,5",
                  weekendStart: source.settings?.weekendStart ?? "09:00",
                  weekendEnd: source.settings?.weekendEnd ?? "18:00",
                  weekendWorkingDays: source.settings?.weekendWorkingDays ?? "",
                },
              },
            },
            select: { id: true, name: true, loginCode: true },
          })

          // Kaynak atölyedeki koltuk korunur; değiştirici ana atölyeye dönebilsin (#900).
          await ensureMembership({
            userId: user.id,
            workshopId: source.id,
            role: "owner",
            tx,
          })
          await activateWorkshopForUser({
            userId: user.id,
            workshopId: branch.id,
            role: "owner",
            tx,
          })

          return branch
        })
        break
      } catch (error) {
        if (isLoginCodeConflict(error) && attempt < MAX_LOGIN_CODE_RETRIES - 1) continue
        throw error
      }
    }

    if (!created) {
      return NextResponse.json({ error: "Şube oluşturulamadı." }, { status: 500 })
    }

    await establishSession(user.id, created.id, "owner")

    return NextResponse.json(
      { workshop: created },
      { status: 201 },
    )
  } catch (error) {
    return apiErrorResponse(error)
  }
}
