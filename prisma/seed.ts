import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Seeding database...")

  // Platform config
  await prisma.platformConfig.upsert({
    where: { id: "platform" },
    update: {},
    create: {
      id: "platform",
      defaultAIProvider: "ANTHROPIC",
      defaultModel: "claude-haiku-4-5",
      anthropicInputPrice: 0.01,
      anthropicOutputPrice: 0.03,
      openaiInputPrice: 0.008,
      openaiOutputPrice: 0.025,
      platformMargin: 1.5,
    },
  })

  // Plans
  await prisma.plan.upsert({
    where: { tier: "STARTER" },
    update: {},
    create: {
      tier: "STARTER", nameAr: "المبتدئ", nameEn: "Starter",
      priceMonthly: 99, priceYearly: 990,
      maxBookingsPerMonth: 200, maxStaff: 1, maxServices: 5,
      includesAIAgents: false, maxAgents: 0,
      features: ["حجوزات أساسية", "صفحة هبوط", "تأكيد واتساب", "تقارير أساسية"],
    },
  })

  await prisma.plan.upsert({
    where: { tier: "GROWTH" },
    update: {},
    create: {
      tier: "GROWTH", nameAr: "النمو", nameEn: "Growth",
      priceMonthly: 249, priceYearly: 2490,
      maxBookingsPerMonth: 1000, maxStaff: 5, maxServices: 20,
      includesAIAgents: true, maxAgents: 4,
      features: ["كل مزايا المبتدئ", "وكلاء AI أساسية", "قائمة انتظار", "تقارير متقدمة", "إدارة موظفين"],
    },
  })

  await prisma.plan.upsert({
    where: { tier: "SCALE" },
    update: {},
    create: {
      tier: "SCALE", nameAr: "التوسع", nameEn: "Scale",
      priceMonthly: 599, priceYearly: 5990,
      maxBookingsPerMonth: -1, maxStaff: -1, maxServices: -1,
      includesAIAgents: true, maxAgents: -1,
      features: ["كل مزايا النمو", "وكلاء غير محدودة", "API access", "دعم أولوية", "Custom domain"],
    },
  })

  // Super admin
  const superAdmin = await prisma.user.upsert({
    where: { email: process.env.SUPER_ADMIN_EMAIL ?? "admin@platform.com" },
    update: {},
    create: {
      email: process.env.SUPER_ADMIN_EMAIL ?? "admin@platform.com",
      passwordHash: await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD ?? "Admin@123456", 12),
      role: "SUPER_ADMIN",
      isVerified: true,
    },
  })

  console.log("✅ Seed complete")
  console.log("   Super admin:", superAdmin.email)
}

main().catch(console.error).finally(() => prisma.$disconnect())
