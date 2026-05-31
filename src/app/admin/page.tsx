import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { requireSuperAdmin } from "@/lib/tenant"
import { getPlatformStats } from "@/lib/admin-stats"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/admin/status-badge"
import { AdminKpiCards, type AdminKpi } from "./admin-home-client"
import { AdminCharts } from "./admin-charts"

// Platform 360° overview — MRR/ARR, business growth, plan mix, and the
// most recent activity across all tenants. Cross-tenant aggregation runs
// strictly behind the super-admin guard (CLAUDE.md §5).
export default async function AdminOverview() {
  await requireSuperAdmin()
  const t = await getTranslations("admin.overview")
  const stats = await getPlatformStats()

  const kpis: AdminKpi[] = [
    {
      key: "mrr",
      value: Math.round(stats.mrr),
      suffix: "SAR",
      growthPct: stats.mrrGrowthPct,
    },
    { key: "arr", value: Math.round(stats.arr), suffix: "SAR" },
    {
      key: "activeBusinesses",
      value: stats.activeBusinesses,
      growthPct: stats.bizGrowthPct,
    },
    { key: "bookingsThisMonth", value: stats.bookingsThisMonth },
  ]

  const paymentKpis: AdminKpi[] = [
    { key: "totalTransactions", value: stats.transactionsThisMonth },
    { key: "nxbookFees", value: Math.round(stats.nxbookPayFees), suffix: "SAR" },
    { key: "paymentBusinesses", value: stats.paymentBusinesses },
  ]

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>

      {/* Row 1 — KPI cards */}
      <AdminKpiCards cards={kpis} />

      {/* Row 1b — payment KPI cards */}
      <AdminKpiCards cards={paymentKpis} />

      {/* Row 2 — charts */}
      <AdminCharts
        data={{
          mrrSeries: stats.mrrSeries,
          planDistribution: stats.planDistribution,
          bizGrowthSeries: stats.bizGrowthSeries,
        }}
      />

      {/* Row 3 — activity tables */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("recentBusinesses")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {stats.recentBusinesses.length === 0 && (
              <p className="text-muted-foreground">{t("noData")}</p>
            )}
            {stats.recentBusinesses.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{b.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.planName ?? "—"} · {fmtDate(b.createdAt)}
                  </p>
                </div>
                <StatusBadge status={b.status} label={b.status ?? undefined} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("topBusinesses")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {stats.top5ByBookings.length === 0 && (
              <p className="text-muted-foreground">{t("noData")}</p>
            )}
            {stats.top5ByBookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-2">
                <Link
                  href={`/${b.slug}`}
                  target="_blank"
                  className="min-w-0 truncate font-medium hover:text-primary hover:underline"
                >
                  {b.name}
                </Link>
                <span className="shrink-0 font-semibold tabular-nums">
                  {b.bookingsThisMonth}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("recentAgentRuns")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {stats.recentAgentLogs.length === 0 && (
              <p className="text-muted-foreground">{t("noData")}</p>
            )}
            {stats.recentAgentLogs.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{l.agentType}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {l.businessName} · {fmtDate(l.createdAt)}
                  </p>
                </div>
                <StatusBadge status={l.status} label={l.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
