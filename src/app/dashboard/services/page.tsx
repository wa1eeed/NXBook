import { requireBusiness } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { ServicesClient, type ServiceRow } from "./services-client"

export default async function ServicesPage() {
  const ctx = await requireBusiness()

  const services = await prisma.service.findMany({
    where: { businessId: ctx.businessId, isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { availability: true } } },
  })

  const rows: ServiceRow[] = services.map((s) => ({
    id: s.id,
    nameEn: s.nameEn,
    nameAr: s.nameAr,
    descriptionEn: s.descriptionEn,
    descriptionAr: s.descriptionAr,
    durationMin: s.durationMin,
    bufferMin: s.bufferMin,
    price: s.price,
    maxCapacity: s.maxCapacity,
    isVisible: s.isVisible,
    paymentMode: s.paymentMode,
    availabilityCount: s._count.availability,
  }))

  return <ServicesClient services={rows} />
}
