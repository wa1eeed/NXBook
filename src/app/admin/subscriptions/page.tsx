// /admin/subscriptions — cross-tenant subscription overview.
// Gated by requireSuperAdmin (explicit cross-tenant code path, CLAUDE.md §5).

import { getLocale, getTranslations } from "next-intl/server"
import { requireSuperAdmin } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { SubscriptionsClient, type SubscriptionRow } from "./subscriptions-client"

export default async function AdminSubscriptionsPage() {
  await requireSuperAdmin()
  const locale = await getLocale()
  const t = await getTranslations("admin.subscriptions")

  const subs = await prisma.subscription.findMany({
    include: {
      plan: { select: { nameEn: true, nameAr: true, priceMonthly: true } },
      business: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const now = Date.now()
  const in7Days = now + 7 * 24 * 60 * 60 * 1000

  const rows: SubscriptionRow[] = subs.map((s) => ({
    id: s.id,
    businessId: s.business.id,
    businessName: s.business.name,
    planName: locale === "ar" ? s.plan.nameAr : s.plan.nameEn,
    priceMonthly: s.plan.priceMonthly,
    status: s.status,
    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
    trialEndsAt: s.trialEndsAt?.toISOString() ?? null,
    currentPeriodEnd: s.currentPeriodEnd.toISOString(),
  }))

  // KPIs
  const active = subs.filter((s) => s.status === "ACTIVE")
  const trialing = subs.filter((s) => s.status === "TRIALING")
  const cancelled = subs.filter((s) => s.status === "CANCELLED")
  const mrr = active.reduce((sum, s) => sum + s.plan.priceMonthly, 0)

  // Upcoming renewals (next 7 days, active, not cancelling)
  const upcomingRenewals = subs.filter(
    (s) =>
      s.status === "ACTIVE" &&
      !s.cancelAtPeriodEnd &&
      s.currentPeriodEnd.getTime() <= in7Days &&
      s.currentPeriodEnd.getTime() >= now,
  )
  const projectedRevenue = upcomingRenewals.reduce(
    (sum, s) => sum + s.plan.priceMonthly,
    0,
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label={t("kpiActive")} value={active.length} />
        <Kpi label={t("kpiTrialing")} value={trialing.length} />
        <Kpi label={t("kpiCancelled")} value={cancelled.length} />
        <Kpi label={t("kpiMrr")} value={`${mrr} SAR`} accent />
        <Kpi label={t("kpiUpcoming")} value={`${projectedRevenue} SAR`} />
      </div>

      <SubscriptionsClient rows={rows} />
    </div>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={accent ? "mt-1 text-2xl font-bold text-primary" : "mt-1 text-2xl font-bold"}>
        {value}
      </p>
    </div>
  )
}
