import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import bcrypt from "bcryptjs"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("🌱 Seeding database...")

  const hashedPassword = await bcrypt.hash("demo123456", 12)

  let workshop = await prisma.workshop.findFirst({ where: { name: "Demo Oto Servis" } })
  if (!workshop) {
    workshop = await prisma.workshop.create({
      data: {
        name: "Demo Oto Servis",
        phone: "0555 123 4567",
        city: "İstanbul",
        address: "Sanayi Mah. 123. Sk. No:5, Kadıköy",
      },
    })
    console.log(`✅ Workshop created: ${workshop.id}`)
  } else {
    console.log(`ℹ️  Workshop exists: ${workshop.id}`)
  }

  let user = await prisma.user.findUnique({ where: { email: "demo@bakimx.com" } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: "demo@bakimx.com",
        password: hashedPassword,
        firstName: "Ahmet",
        lastName: "Yılmaz",
        workshopId: workshop.id,
      },
    })
    console.log(`✅ User created: ${user.id}`)
  } else {
    console.log(`ℹ️  User exists: ${user.id}`)
  }

  let customer = await prisma.customer.findFirst({
    where: { workshopId: workshop.id, fullName: "Mehmet Kaya" },
  })
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        workshopId: workshop.id,
        type: "individual",
        firstName: "Mehmet",
        lastName: "Kaya",
        fullName: "Mehmet Kaya",
        phone: "0533 987 6543",
        email: "mehmet@email.com",
        city: "İstanbul",
        tag: "vip",
        source: "google",
        priceGroup: "standard",
        discountRate: 0,
        whatsappConsent: true,
        smsConsent: true,
        emailConsent: false,
        kvkkApprovedAt: new Date(),
      },
    })
    console.log(`✅ Customer (Mehmet) created: ${customer.id}`)
  } else {
    console.log(`ℹ️  Customer (Mehmet) exists: ${customer.id}`)
  }

  const corp = await prisma.customer.findFirst({
    where: { workshopId: workshop.id, companyName: "Anadolu Lojistik A.Ş." },
  })
  if (!corp) {
    await prisma.customer.create({
      data: {
        workshopId: workshop.id,
        type: "corporate",
        companyName: "Anadolu Lojistik A.Ş.",
        contactName: "Ayşe Demir",
        fullName: "Anadolu Lojistik A.Ş.",
        phone: "0212 555 0011",
        email: "info@anadolulojistik.com",
        city: "İstanbul",
        taxNumber: "1234567890",
        taxOffice: "Kadıköy VD",
        tag: "fleet",
        source: "referral",
        priceGroup: "fleet",
        discountRate: 10,
        whatsappConsent: true,
        smsConsent: false,
        emailConsent: true,
        kvkkApprovedAt: new Date(),
      },
    })
    console.log(`✅ Customer (Anadolu) created`)
  } else {
    console.log(`ℹ️  Customer (Anadolu) exists`)
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { workshopId: workshop.id, customerId: customer.id, plate: "34 ABC 123" },
  })
  if (!vehicle) {
    const v = await prisma.vehicle.create({
      data: {
        workshopId: workshop.id,
        customerId: customer.id,
        plate: "34 ABC 123",
        brand: "Toyota",
        model: "Corolla",
        vehicleType: "Sedan",
        modelYear: 2020,
        mileage: 45000,
        vin: "1HGBH41JXMN109186",
      },
    })
    console.log(`✅ Vehicle created: ${v.id}`)
  } else {
    console.log(`ℹ️  Vehicle exists`)
  }

  const intakeCount = await prisma.vehicleIntakeForm.count({
    where: { workshopId: workshop.id, customerId: customer.id },
  })
  if (intakeCount === 0 && vehicle) {
    const intake = await prisma.vehicleIntakeForm.create({
      data: {
        workshopId: workshop.id,
        customerId: customer.id,
        vehicleId: vehicle.id,
        status: "draft",
        mileageAtIntake: 45000,
        customerComplaint: "Motor arıza lambası yanıyor, fren sesi var",
        internalNote: "Müşteri acil bakım istiyor",
      },
    })
    console.log(`✅ Intake form created: ${intake.id}`)
  }

  console.log("\n📋 Demo Login Credentials:")
  console.log("   Email: demo@bakimx.com")
  console.log("   Password: demo123456")
  console.log("\n✅ Seed completed!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })