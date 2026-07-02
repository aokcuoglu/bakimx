import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { normalizePhone, normalizePlate } from "@/lib/format"
import { AuditLogAction } from "@/lib/audit"
import type { Customer, Prisma, Vehicle } from "@prisma/client"

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function parseModelYear(value: unknown): number | null {
  const year = Number.parseInt(clean(value), 10)
  const currentYear = new Date().getFullYear()
  return Number.isInteger(year) && year >= 1900 && year <= currentYear + 1 ? year : null
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { ocrLogId, confirmedFields } = body

    if (!ocrLogId || !confirmedFields) {
      return NextResponse.json(
        { error: "OCR log ID ve onaylanan alanlar zorunludur" },
        { status: 400 }
      )
    }

    const ocrLog = await prisma.ocrLog.findFirst({
      where: { id: ocrLogId, workshopId: user.workshopId },
    })
    if (!ocrLog) {
      return NextResponse.json({ error: "OCR kaydı bulunamadı" }, { status: 404 })
    }

    const plate = normalizePlate(clean(confirmedFields.plate))
    const brand = clean(confirmedFields.brand)
    const model = clean(confirmedFields.model)
    const vin = clean(confirmedFields.vin).toUpperCase()
    const ownerName = clean(confirmedFields.ownerName)
    const ownerSurname = clean(confirmedFields.ownerSurname)
    const phone = normalizePhone(clean(confirmedFields.phone))
    const vehicleType = clean(confirmedFields.vehicleType)
    const modelYear = parseModelYear(confirmedFields.modelYear)
    const engineNo = clean(confirmedFields.engineNo).toUpperCase()

    if (!plate) {
      return NextResponse.json({ error: "Plaka alanı zorunludur" }, { status: 400 })
    }
    if (!brand || !model) {
      return NextResponse.json({ error: "Marka ve model alanları zorunludur" }, { status: 400 })
    }
    if (!ownerName || !ownerSurname) {
      return NextResponse.json({ error: "Müşteri adı ve soyadı zorunludur" }, { status: 400 })
    }

    const warnings: string[] = []

    const plateConflict = await prisma.vehicle.findFirst({
      where: { workshopId: user.workshopId, plate },
      include: { customer: true },
    })
    if (plateConflict) {
      warnings.push(`Bu plaka (${plate}) ile kayıtlı bir araç zaten mevcut: ${plateConflict.brand} ${plateConflict.model}`)
    }

    if (vin && vin.length >= 5) {
      const vinConflict = await prisma.vehicle.findFirst({
        where: { workshopId: user.workshopId, vin },
        include: { customer: true },
      })
      if (vinConflict && (!plateConflict || vinConflict.id !== plateConflict.id)) {
        warnings.push(`Bu şase numarası (${vin.substring(0, 8)}...) ile kayıtlı başka bir araç mevcut: ${vinConflict.plate} - ${vinConflict.brand} ${vinConflict.model}`)
      }
    }

    const matchingVehicles = await prisma.vehicle.findMany({
      where: {
        workshopId: user.workshopId,
        OR: [
          { plate },
          ...(vin ? [{ vin }] : []),
        ],
      },
      include: { customer: true },
      take: 2,
    })

    if (matchingVehicles.length > 1) {
      return NextResponse.json(
        { error: "Plaka ve şase numarası farklı araç kayıtlarıyla eşleşiyor. Lütfen Araçlar bölümünden kontrol edin.", warnings },
        { status: 409 }
      )
    }

    const existingVehicle = matchingVehicles[0] || null
    if (phone.length < 10) {
      return NextResponse.json(
        { error: "En az 10 haneli müşteri telefon numarası giriniz" },
        { status: 400 }
      )
    }

    const seedCustomer: Customer | null =
      existingVehicle && normalizePhone(existingVehicle.customer.phone) === phone
        ? existingVehicle.customer
        : null

    let result: {
      customer: Customer
      vehicle: Vehicle
      customerCreated: boolean
      vehicleCreated: boolean
      vehicleCustomerChanged: boolean
    }

    try {
      result = await prisma.$transaction(async (tx) => {
        let customer = seedCustomer
        let customerCreated = false
        let vehicleCreated = false
        let vehicleCustomerChanged = false

        if (!customer) {
          customer = await tx.customer.findFirst({
            where: { workshopId: user.workshopId, phone },
          })

          if (!customer) {
            customer = await tx.customer.create({
              data: {
                workshopId: user.workshopId,
                type: "individual",
                firstName: ownerName,
                lastName: ownerSurname,
                fullName: `${ownerName} ${ownerSurname}`.trim(),
                phone,
                source: "walk_in",
                notes: "Ruhsat okuma ile oluşturuldu.",
              },
            })
            customerCreated = true
          }
        }

        let vehicle: Vehicle
        if (existingVehicle) {
          const updateData: Prisma.VehicleUpdateInput = { brand, model, plate }
          if (existingVehicle.customerId !== customer.id) {
            updateData.customer = { connect: { id: customer.id } }
            vehicleCustomerChanged = true
          }
          if (vin) updateData.vin = vin
          if (vehicleType) updateData.vehicleType = vehicleType
          if (modelYear) updateData.modelYear = modelYear
          if (engineNo) updateData.engineNo = engineNo
          if (vin && vin.length === 17) updateData.vinConfirmed = true

          vehicle = await tx.vehicle.update({
            where: { id: existingVehicle.id },
            data: updateData,
          })
        } else {
          vehicle = await tx.vehicle.create({
            data: {
              workshopId: user.workshopId,
              customerId: customer.id,
              plate,
              brand,
              model,
              vehicleType: vehicleType || null,
              modelYear,
              vin: vin || null,
              vinConfirmed: vin.length === 17,
              engineNo: engineNo || null,
            },
          })
          vehicleCreated = true
        }

        await tx.ocrLog.update({
          where: { id: ocrLogId },
          data: {
            confirmedJson: JSON.stringify(confirmedFields),
            confirmedAt: new Date(),
            customerId: customer.id,
            vehicleId: vehicle.id,
            userId: user.id,
          },
        })

        return { customer, vehicle, customerCreated, vehicleCreated, vehicleCustomerChanged }
      })
    } catch (createError: unknown) {
      if (
        createError instanceof Error &&
        (createError.message.includes("Unique constraint") ||
          createError.message.includes("UniqueConstraint"))
      ) {
        return NextResponse.json(
          {
            error:
              "Bu plaka ile kayıtlı bir araç zaten var. " +
              "Lütfen sayfayı yenileyip tekrar deneyin veya Araçlar bölümünden düzenleyin.",
          },
          { status: 409 }
        )
      }
      throw createError
    }

    const { customer, vehicle, customerCreated, vehicleCreated, vehicleCustomerChanged } = result

    if (customerCreated) {
      await AuditLogAction(user.workshopId, user.id, "Customer", customer.id, "customer_created_via_ocr")
    }
    await AuditLogAction(
      user.workshopId,
      user.id,
      "Vehicle",
      vehicle.id,
      vehicleCreated ? "vehicle_created_via_ocr" : "vehicle_updated_via_ocr"
    )
    await AuditLogAction(
      user.workshopId,
      user.id,
      "OcrLog",
      ocrLogId,
      "ocr_confirmed",
      JSON.stringify({ vehicleId: vehicle.id, customerId: customer.id })
    )

    revalidatePath("/customers")
    revalidatePath(`/customers/${customer.id}`)
    revalidatePath("/vehicles")
    revalidatePath(`/vehicles/${vehicle.id}`)

    const customerName =
      customer.type === "corporate"
        ? customer.companyName || "Kurumsal Müşteri"
        : [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
          customer.fullName ||
          "Müşteri"

    return NextResponse.json({
      success: true,
      customerId: customer.id,
      vehicleId: vehicle.id,
      customerCreated,
      vehicleCreated,
      vehicleCustomerChanged,
      customerName,
      vehicleLabel: `${vehicle.plate} - ${vehicle.brand} ${vehicle.model}`,
      intakeUrl: `/orders/new?customerId=${customer.id}&vehicleId=${vehicle.id}&source=registration`,
      ...(warnings.length > 0 ? { warnings } : {}),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bir hata oluştu"
    console.error("[OCR CONFIRM ERROR]", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}