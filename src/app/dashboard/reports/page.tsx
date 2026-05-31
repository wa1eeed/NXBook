import { getLocale } from "next-intl/server"
import { requireBusiness } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { computeReport } from "@/lib/reports"
import type { Locale } from "@/i18n/config"
import { ReportsClient } from "./reports-client"

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  const ctx = await requireBusiness()
  const locale = (await getLocale()) as Locale
  const { days: daysParam } = await searchParams
  const days = [7, 30, 90].includes(Number(daysParam)) ? Number(daysParam) : 30

  const metrics = await computeReport(
    ctx.businessId,
    days,
    locale === "ar" ? "ar" : "en",
  )

  // Latest weekly AI report (written by the Analytics agent), if any.
  const latest = await prisma.report.findFirst({
    where: { businessId: ctx.businessId, type: "weekly_analytics" },
    orderBy: { generatedAt: "desc" },
  })
  const aiReport =
    latest && typeof (latest.data as Record<string, unknown>)?.recommendations === "string"
      ? {
          recommendations: (latest.data as { recommendations: string }).recommendations,
          period: latest.period,
        }
      : null

  return <ReportsClient metrics={metrics} days={days} aiReport={aiReport} />
}
