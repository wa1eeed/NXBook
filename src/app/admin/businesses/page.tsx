import { requireSuperAdmin } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { BusinessesClient, type BizRow } from "./businesses-client"

export default async function AdminBusinesses() {
  await requireSuperAdmin()

  const thisMonthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  )

  const businesses = await prisma.business.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subscription: {
        include: { plan: { select: { nameEn: true } } },
      },
      _count: { select: { bookings: true, customers: true } },
    },
  })

  // Per-business bookings-this-month + last booking date. groupBy keeps
  // this to two extra queries regardless of tenant count.
  const [monthly, lastBookings] = await Promise.all([
    prisma.booking.groupBy({
      by: ["businessId"],
      where: { createdAt: { gte: thisMonthStart } },
      _count: { _all: true },
    }),
    prisma.booking.groupBy({
      by: ["businessId"],
      _max: { date: true },
    }),
  ])
  const monthMap = new Map(monthly.map((m) => [m.businessId, m._count._all]))
  const lastMap = new Map(
    lastBookings.map((l) => [l.businessId, l._max.date?.toISOString() ?? null]),
  )

  const rows: BizRow[] = businesses.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    type: b.type,
    isActive: b.isActive,
    plan: b.subscription?.plan.nameEn ?? null,
    status: b.subscription?.status ?? null,
    trialEndsAt: b.subscription?.trialEndsAt?.toISOString() ?? null,
    bookings: b._count.bookings,
    bookingsThisMonth: monthMap.get(b.id) ?? 0,
    customers: b._count.customers,
    lastBookingAt: lastMap.get(b.id) ?? null,
    createdAt: b.createdAt.toISOString(),
  }))

  return <BusinessesClient businesses={rows} />
}
