import { getLocale } from "next-intl/server"
import { requireBusiness } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { NewBookingClient, type ServiceOption } from "./new-booking-client"

export default async function NewBookingPage() {
  const ctx = await requireBusiness()
  const locale = await getLocale()

  const [services, customers] = await Promise.all([
    prisma.service.findMany({
      where: { businessId: ctx.businessId, isActive: true },
      select: {
        id: true,
        nameEn: true,
        nameAr: true,
        durationMin: true,
        price: true,
      },
    }),
    prisma.customer.findMany({
      where: { businessId: ctx.businessId },
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
  ])

  const serviceOptions: ServiceOption[] = services.map((s) => ({
    id: s.id,
    name: locale === "ar" && s.nameAr ? s.nameAr : s.nameEn,
    durationMin: s.durationMin,
    price: s.price,
  }))

  return <NewBookingClient services={serviceOptions} customers={customers} />
}
