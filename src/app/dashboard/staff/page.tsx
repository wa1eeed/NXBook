import { requireBusiness } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { StaffClient, type StaffRow, type ServiceOption } from "./staff-client"

export default async function StaffPage() {
  const ctx = await requireBusiness()

  const [staff, services] = await Promise.all([
    prisma.staff.findMany({
      where: { businessId: ctx.businessId, isActive: true },
      orderBy: { createdAt: "asc" },
      include: { services: { select: { serviceId: true } } },
    }),
    prisma.service.findMany({
      where: { businessId: ctx.businessId, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, nameEn: true, nameAr: true },
    }),
  ])

  const rows: StaffRow[] = staff.map((m) => ({
    id: m.id,
    name: m.name,
    phone: m.phone,
    email: m.email,
    serviceIds: m.services.map((s) => s.serviceId),
  }))

  return <StaffClient staff={rows} services={services as ServiceOption[]} />
}
