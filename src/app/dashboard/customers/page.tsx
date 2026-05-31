import { getLocale } from "next-intl/server"
import { requireBusiness } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { CustomersClient, type CustomerRow } from "./customers-client"

export default async function CustomersPage() {
  const ctx = await requireBusiness()
  const locale = await getLocale()

  const customers = await prisma.customer.findMany({
    where: { businessId: ctx.businessId },
    orderBy: [{ isVIP: "desc" }, { lastVisitAt: "desc" }],
    take: 300,
    include: {
      _count: { select: { bookings: true } },
      bookings: {
        take: 20,
        orderBy: { date: "desc" },
        include: { service: { select: { nameEn: true, nameAr: true } } },
      },
    },
  })

  const localized = (en: string, ar: string | null) =>
    locale === "ar" && ar ? ar : en

  const rows: CustomerRow[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    notes: c.notes,
    isBlocked: c.isBlocked,
    isVIP: c.isVIP,
    noShowScore: c.noShowScore,
    loyaltyScore: c.loyaltyScore,
    totalBookings: c.totalBookings,
    totalNoShows: c.totalNoShows,
    totalSpent: c.totalSpent,
    lastVisitAt: c.lastVisitAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    bookingsCount: c._count.bookings,
    recentBookings: c.bookings.map((b) => ({
      id: b.id,
      date: b.date.toISOString().slice(0, 10),
      startTime: b.startTime,
      status: b.status,
      serviceName: localized(b.service.nameEn, b.service.nameAr),
      amount: b.paymentAmount,
    })),
  }))

  return <CustomersClient customers={rows} />
}
