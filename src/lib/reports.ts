// ============================================================
// Reports computation — tenant-scoped analytics over a time
// window. Pure aggregation over Booking/Waitlist; the dashboard
// renders the result, and the Analytics agent reuses the same
// shape. Always scoped by the businessId passed in (CLAUDE.md §5).
// Flagship metric: waitlist conversion / "revenue saved".
// ============================================================

import { prisma } from "@/lib/prisma"
import { BookingStatus, WaitlistStatus } from "@prisma/client"

export interface ReportMetrics {
  days: number
  totalBookings: number
  attended: number
  noShows: number
  cancelled: number
  pending: number
  confirmed: number
  attendanceRate: number // %
  noShowRate: number // %
  revenue: number // SAR from attended
  avgPrice: number
  // Flagship: waitlist conversion.
  waitlistJoined: number
  waitlistConfirmed: number
  waitlistConversionRate: number // %
  revenueSaved: number // SAR recovered by the waitlist
  // Series for charts.
  peakHours: { hour: number; count: number }[] // 0..23
  dailyBookings: { date: string; count: number }[]
  topServices: { name: string; count: number; revenue: number }[]
}

const OCCUPYING: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.ATTENDED,
]

export async function computeReport(
  businessId: string,
  days = 30,
  locale: "en" | "ar" = "en",
): Promise<ReportMetrics> {
  const since = new Date()
  since.setHours(0, 0, 0, 0)
  since.setDate(since.getDate() - (days - 1))

  const [bookings, waitlistJoined, waitlistConfirmed] = await Promise.all([
    prisma.booking.findMany({
      where: { businessId, createdAt: { gte: since } },
      select: {
        status: true,
        startTime: true,
        date: true,
        createdAt: true,
        service: { select: { nameEn: true, nameAr: true, price: true } },
      },
    }),
    prisma.waitlist.count({ where: { businessId, createdAt: { gte: since } } }),
    prisma.waitlist.count({
      where: { businessId, status: WaitlistStatus.CONFIRMED, confirmedAt: { gte: since } },
    }),
  ])

  const total = bookings.length
  const attended = bookings.filter((b) => b.status === "ATTENDED").length
  const noShows = bookings.filter((b) => b.status === "NO_SHOW").length
  const cancelled = bookings.filter((b) => b.status === "CANCELLED").length
  const pending = bookings.filter((b) => b.status === "PENDING").length
  const confirmed = bookings.filter((b) => b.status === "CONFIRMED").length

  const revenue = bookings
    .filter((b) => b.status === "ATTENDED")
    .reduce((s, b) => s + (b.service?.price ?? 0), 0)
  const avgPrice = attended > 0 ? revenue / attended : 0

  // Peak hours: count occupying bookings by their start hour.
  const hourMap = new Map<number, number>()
  for (const b of bookings) {
    if (!OCCUPYING.includes(b.status)) continue
    const h = Number(b.startTime.split(":")[0])
    if (!Number.isNaN(h)) hourMap.set(h, (hourMap.get(h) ?? 0) + 1)
  }
  const peakHours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: hourMap.get(hour) ?? 0,
  }))

  // Daily bookings series across the window.
  const dayMap = new Map<string, number>()
  for (let i = 0; i < days; i++) {
    const d = new Date(since)
    d.setDate(since.getDate() + i)
    dayMap.set(d.toISOString().slice(0, 10), 0)
  }
  for (const b of bookings) {
    const key = b.createdAt.toISOString().slice(0, 10)
    if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) ?? 0) + 1)
  }
  const dailyBookings = Array.from(dayMap.entries()).map(([date, count]) => ({
    date,
    count,
  }))

  // Top services by attended count + revenue.
  const svcMap = new Map<string, { count: number; revenue: number }>()
  for (const b of bookings) {
    if (b.status !== "ATTENDED" || !b.service) continue
    const name =
      locale === "ar" && b.service.nameAr ? b.service.nameAr : b.service.nameEn
    const cur = svcMap.get(name) ?? { count: 0, revenue: 0 }
    cur.count += 1
    cur.revenue += b.service.price
    svcMap.set(name, cur)
  }
  const topServices = Array.from(svcMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const waitlistConversionRate =
    waitlistJoined > 0 ? Math.round((waitlistConfirmed / waitlistJoined) * 100) : 0
  const revenueSaved = Math.round(waitlistConfirmed * avgPrice)

  return {
    days,
    totalBookings: total,
    attended,
    noShows,
    cancelled,
    pending,
    confirmed,
    attendanceRate: total > 0 ? Math.round((attended / total) * 100) : 0,
    noShowRate: total > 0 ? Math.round((noShows / total) * 100) : 0,
    revenue: Math.round(revenue),
    avgPrice: Math.round(avgPrice),
    waitlistJoined,
    waitlistConfirmed,
    waitlistConversionRate,
    revenueSaved,
    peakHours,
    dailyBookings,
    topServices,
  }
}
