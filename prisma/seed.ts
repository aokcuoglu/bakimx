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

  const workshop = await prisma.workshop.create({
    data: {
      name: "Demo Oto Servis",
      phone: "0555 123 4567",
      city: "İstanbul",
      address: "Sanayi Mah. 123. Sk. No:5, Kadıköy",
    },
  })

  console.log(`✅ Workshop created: ${workshop.id}`)

  const user = await prisma.user.create({
    data: {
      email: "demo@bakimx.com",
      password: hashedPassword,
      firstName: "Ahmet",
      lastName: "Yılmaz",
      workshopId: workshop.id,
    },
  })

  console.log(`✅ User created: ${user.id}`)

  const customer = await prisma.customer.create({
    data: {
      workshopId: workshop.id,
      firstName: "Mehmet",
      lastName: "Kaya",
      phone: "0533 987 6543",
      email: "mehmet@email.com",
    },
  })

  console.log(`✅ Customer created: ${customer.id}`)

  const vehicle = await prisma.vehicle.create({
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

  console.log(`✅ Vehicle created: ${vehicle.id}`)

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