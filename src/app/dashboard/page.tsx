import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { CalendarDays, Plus } from "lucide-react"
import { requireBusiness } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { MotionList, MotionItem } from "@/components/ui/motion-list"
import { cn } from "@/lib/utils"
import { formatTime12 } from "@/lib/time"
import { KpiCards, type KpiCard } from "./home-client"
import { SetupChecklist, type SetupStatus } from "./setup-checklist"

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  CONFIRMED: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  ATTENDED: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  NO_SHOW: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  CANCELLED: "bg-muted text-muted-foreground",
}

const STATUS_KEY: Record<string, string> = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  ATTENDED: "attended",
  NO_SHOW: "noShow",
  CANCELLED: "cancelled",
}

export default async function DashboardHome() {
  const ctx = await requireBusiness()
  const td = await getTranslations("dashboard")
  const ts = await getTranslations("status")
  const locale = await getLocale()

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date(startOfToday)
  endOfToday.setDate(endOfToday.getDate() + 1)
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)

  const [
    todayBookings,
    yesterdayBookings,
    todayList,
    waitlistActive,
    totalServices,
    totalCustomers,
    // Setup checklist signals — cheap counts only.
    availabilityCount,
    businessRow,
    firstBookingRow,
  ] = await Promise.all([
    prisma.booking.count({
      where: {
        businessId: ctx.businessId,
        date: { gte: startOfToday, lt: endOfToday },
      },
    }),
    prisma.booking.count({
      where: {
        businessId: ctx.businessId,
        date: { gte: startOfYesterday, lt: startOfToday },
      },
    }),
    prisma.booking.findMany({
      where: {
        businessId: ctx.businessId,
        date: { gte: startOfToday, lt: endOfToday },
      },
      orderBy: { startTime: "asc" },
      take: 10,
      include: {
        customer: { select: { name: true } },
        service: { select: { nameEn: true, nameAr: true } },
      },
    }),
    prisma.waitlist.count({
      where: { businessId: ctx.businessId, status: "WAITING" },
    }),
    prisma.service.count({
      where: { businessId: ctx.businessId, isActive: true },
    }),
    prisma.customer.count({ where: { businessId: ctx.businessId } }),
    prisma.serviceAvailability.count({
      where: { service: { businessId: ctx.businessId, isActive: true } },
    }),
    prisma.business.findUnique({
      where: { id: ctx.businessId },
      select: { logoUrl: true, brandColor: true, slug: true },
    }),
    prisma.booking.findFirst({
      where: { businessId: ctx.businessId },
      select: { id: true },
    }),
  ])

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const setupStatus: SetupStatus = {
    hasService: totalServices > 0,
    hasAvailability: availabilityCount > 0,
    // Branded = has uploaded a logo OR picked a non-default brand color.
    // The default seeded color is "#7c3aed" (violet); any other value counts.
    hasBranding:
      !!businessRow?.logoUrl ||
      (businessRow?.brandColor != null && businessRow.brandColor !== "#7c3aed"),
    hasFirstBooking: !!firstBookingRow,
    publicUrl: businessRow ? `${appUrl}/${businessRow.slug}` : appUrl,
  }

  const cards: KpiCard[] = [
    { key: "todayBookings", value: todayBookings, trend: todayBookings - yesterdayBookings },
    { key: "activeServices", value: totalServices },
    { key: "totalCustomers", value: totalCustomers },
    { key: "waitlistActive", value: waitlistActive },
  ]

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{td("home")}</h1>

      <SetupChecklist status={setupStatus} />

      <KpiCards cards={cards} />

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          {td("quickActions")}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/dashboard/bookings">
              <Plus className="size-4" />
              {td("newBooking")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/services">
              <Plus className="size-4" />
              {td("addService")}
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{td("todaySchedule")}</CardTitle>
        </CardHeader>
        <CardContent>
          {todayList.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title={td("noBookingsToday")}
            />
          ) : (
            <MotionList className="flex flex-col gap-2">
              {todayList.map((b) => {
                const serviceName =
                  locale === "ar" && b.service.nameAr
                    ? b.service.nameAr
                    : b.service.nameEn
                return (
                  <MotionItem key={b.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                          {formatTime12(b.startTime, locale)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {b.customer.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {serviceName}
                          </p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          STATUS_STYLE[b.status] ?? "",
                        )}
                      >
                        {ts(STATUS_KEY[b.status] ?? "pending")}
                      </span>
                    </div>
                  </MotionItem>
                )
              })}
            </MotionList>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
