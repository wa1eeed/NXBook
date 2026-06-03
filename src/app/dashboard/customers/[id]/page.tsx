// ============================================================
// /dashboard/customers/[id] — Full customer detail page.
// Server component: fetches all tabs' data in parallel.
// Tenant-scoped via requireBusiness().
// ============================================================

import { notFound } from "next/navigation"
import { getLocale } from "next-intl/server"
import { requireBusiness } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { CustomerDetailClient } from "./customer-detail-client"

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await requireBusiness()
  const locale = await getLocale()

  const localized = (en: string, ar: string | null) =>
    locale === "ar" && ar ? ar : en

  const [customer, bookings, waitlists, transactions] = await Promise.all([
    prisma.customer.findFirst({
      where: { id, businessId: ctx.businessId },
    }),
    prisma.booking.findMany({
      where: { customerId: id, businessId: ctx.businessId },
      orderBy: { date: "desc" },
      include: {
        service: { select: { nameEn: true, nameAr: true } },
        staff: { select: { name: true } },
      },
    }),
    prisma.waitlist.findMany({
      where: { customerId: id, businessId: ctx.businessId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.transaction.findMany({
      where: {
        customerId: id,
        businessId: ctx.businessId,
        status: "PAID",
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  if (!customer) notFound()

  // Build timeline events sorted by date descending
  type TimelineEvent = {
    id: string
    type:
      | "booking_created"
      | "booking_confirmed"
      | "booking_attended"
      | "booking_noshow"
      | "booking_cancelled"
      | "waitlist_joined"
      | "waitlist_offered"
      | "waitlist_confirmed"
      | "payment"
    timestamp: string
    serviceName: string
    amount?: number | null
    notes?: string | null
  }

  const events: TimelineEvent[] = []

  for (const b of bookings) {
    const svc = localized(b.service.nameEn, b.service.nameAr)
    const bdate = `${b.date.toISOString().slice(0, 10)} ${b.startTime}`
    events.push({
      id: `b-created-${b.id}`,
      type: "booking_created",
      timestamp: b.createdAt.toISOString(),
      serviceName: svc,
      notes: b.notes,
    })
    if (b.confirmedAt)
      events.push({ id: `b-conf-${b.id}`, type: "booking_confirmed", timestamp: b.confirmedAt.toISOString(), serviceName: svc })
    if (b.attendedAt)
      events.push({ id: `b-att-${b.id}`, type: "booking_attended", timestamp: b.attendedAt.toISOString(), serviceName: svc })
    if (b.cancelledAt)
      events.push({
        id: `b-can-${b.id}`,
        type: b.status === "NO_SHOW" ? "booking_noshow" : "booking_cancelled",
        timestamp: b.cancelledAt.toISOString(),
        serviceName: svc,
        notes: b.cancelReason,
      })
  }

  // Fetch service names for waitlist entries (Waitlist has no service relation)
  const waitlistServiceIds = [...new Set(waitlists.map((w) => w.serviceId))]
  const waitlistServices = waitlistServiceIds.length
    ? await prisma.service.findMany({
        where: { id: { in: waitlistServiceIds } },
        select: { id: true, nameEn: true, nameAr: true },
      })
    : []
  const svcMap: Record<string, { nameEn: string; nameAr: string | null }> = {}
  for (const s of waitlistServices) svcMap[s.id] = s

  for (const w of waitlists) {
    const svcRow = svcMap[w.serviceId]
    const svc = svcRow ? localized(svcRow.nameEn, svcRow.nameAr) : w.serviceId
    events.push({
      id: `w-join-${w.id}`,
      type: "waitlist_joined",
      timestamp: w.createdAt.toISOString(),
      serviceName: svc,
    })
    if (w.offeredAt)
      events.push({ id: `w-off-${w.id}`, type: "waitlist_offered", timestamp: w.offeredAt.toISOString(), serviceName: svc })
    if (w.status === "CONFIRMED")
      events.push({
        id: `w-conf-${w.id}`,
        type: "waitlist_confirmed",
        timestamp: w.offeredAt?.toISOString() ?? w.createdAt.toISOString(),
        serviceName: svc,
      })
  }

  for (const tx of transactions) {
    events.push({
      id: `tx-${tx.id}`,
      type: "payment",
      timestamp: tx.createdAt.toISOString(),
      serviceName: "",
      amount: tx.amount,
    })
  }

  events.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  // Service frequency for stats tab
  const serviceFreq: Record<string, number> = {}
  for (const b of bookings) {
    const svc = localized(b.service.nameEn, b.service.nameAr)
    serviceFreq[svc] = (serviceFreq[svc] ?? 0) + 1
  }
  const topServices = Object.entries(serviceFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  // Preferred booking hours
  const hourFreq: Record<number, number> = {}
  for (const b of bookings) {
    const h = Number(b.startTime.split(":")[0])
    hourFreq[h] = (hourFreq[h] ?? 0) + 1
  }

  // Monthly visit trend (last 6 months)
  const now = new Date()
  const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const label = d.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { month: "short" })
    const count = bookings.filter((b) => {
      const bd = new Date(b.date)
      return bd.getFullYear() === d.getFullYear() && bd.getMonth() === d.getMonth()
    }).length
    return { label, count }
  })

  return (
    <CustomerDetailClient
      customer={{
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        notes: customer.notes,
        isBlocked: customer.isBlocked,
        blockReason: customer.blockReason,
        isVIP: customer.isVIP,
        noShowScore: customer.noShowScore,
        loyaltyScore: customer.loyaltyScore,
        totalBookings: customer.totalBookings,
        totalNoShows: customer.totalNoShows,
        totalSpent: customer.totalSpent,
        lastVisitAt: customer.lastVisitAt?.toISOString() ?? null,
        createdAt: customer.createdAt.toISOString(),
      }}
      bookings={bookings.map((b) => ({
        id: b.id,
        date: b.date.toISOString().slice(0, 10),
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        serviceName: localized(b.service.nameEn, b.service.nameAr),
        staffName: b.staff?.name ?? null,
        notes: b.notes,
        paymentStatus: b.paymentStatus,
        paymentAmount: b.paymentAmount,
      }))}
      timeline={events}
      topServices={topServices}
      monthlyTrend={monthlyTrend}
    />
  )
}
