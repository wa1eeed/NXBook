import { getLocale } from "next-intl/server"
import { requireBusiness } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { BookingsClient, type BookingRow } from "./bookings-client"

export default async function Page() {
  const ctx = await requireBusiness()
  const locale = await getLocale()

  const [bookings, services, staff, business] = await Promise.all([
    prisma.booking.findMany({
      where: { businessId: ctx.businessId },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
      take: 200,
      include: {
        customer: { select: { name: true, phone: true } },
        service: { select: { nameEn: true, nameAr: true } },
        staff: { select: { name: true } },
      },
    }),
    prisma.service.findMany({
      where: { businessId: ctx.businessId, isActive: true },
      select: { id: true, nameEn: true, nameAr: true },
    }),
    prisma.staff.findMany({
      where: { businessId: ctx.businessId, isActive: true },
      select: { id: true, name: true },
    }),
    prisma.business.findUnique({
      where: { id: ctx.businessId },
      select: { paymentEnabled: true },
    }),
  ])

  const localized = (en: string, ar: string | null) =>
    locale === "ar" && ar ? ar : en

  const rows: BookingRow[] = bookings.map((b) => ({
    id: b.id,
    shortId: b.id.slice(-8),
    date: b.date.toISOString().slice(0, 10),
    startTime: b.startTime,
    endTime: b.endTime,
    status: b.status,
    serviceName: localized(b.service.nameEn, b.service.nameAr),
    serviceId: b.serviceId,
    staffName: b.staff?.name ?? null,
    staffId: b.staffId,
    customerName: b.customer.name,
    customerPhone: b.customer.phone,
    bookedVia: b.bookedVia,
    paymentStatus: b.paymentStatus,
    paymentAmount: b.paymentAmount,
    notes: b.notes,
  }))

  const serviceOptions = services.map((s) => ({
    id: s.id,
    name: localized(s.nameEn, s.nameAr),
  }))

  return (
    <BookingsClient
      bookings={rows}
      services={serviceOptions}
      staff={staff}
      paymentEnabled={business?.paymentEnabled ?? false}
    />
  )
}
