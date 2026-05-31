import { requireSuperAdmin } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { CustomersClient, type CustomerRow } from "./customers-client"

// Cross-tenant customer directory. Intentional cross-tenant read behind
// the super-admin guard (CLAUDE.md §5).
export default async function AdminCustomers() {
  await requireSuperAdmin()

  const customers = await prisma.customer.findMany({
    include: { business: { select: { name: true, slug: true } } },
    orderBy: [{ isVIP: "desc" }, { totalBookings: "desc" }],
    take: 500,
  })

  const rows: CustomerRow[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    businessName: c.business.name,
    totalBookings: c.totalBookings,
    totalSpent: c.totalSpent,
    lastVisitAt: c.lastVisitAt?.toISOString() ?? null,
    noShowScore: c.noShowScore,
    loyaltyScore: c.loyaltyScore,
    isVIP: c.isVIP,
    isBlocked: c.isBlocked,
  }))

  return <CustomersClient customers={rows} />
}
