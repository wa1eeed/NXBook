"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Download } from "lucide-react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"
import type { ReportMetrics } from "@/lib/reports"
import { exportReportCsv } from "./actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { formatTime12 } from "@/lib/time"

const PERIODS = [7, 30, 90]

export function ReportsClient({
  metrics,
  days,
  aiReport,
}: {
  metrics: ReportMetrics
  days: number
  aiReport: { recommendations: string; period: string } | null
}) {
  const t = useTranslations("reports")
  const locale = useLocale()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function setPeriod(d: number) {
    router.push(`/dashboard/reports?days=${d}`)
  }

  function download() {
    startTransition(async () => {
      const csv = await exportReportCsv(days)
      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `nxbook-report-${days}d.csv`
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  const kpis = [
    { key: "revenue", value: `${metrics.revenue} SAR` },
    { key: "totalBookings", value: metrics.totalBookings },
    { key: "attendanceRate", value: `${metrics.attendanceRate}%` },
    { key: "noShowRate", value: `${metrics.noShowRate}%` },
  ]

  // Show a readable subset of peak hours (business hours 7–22) using
  // 12-hour AM/PM labels for parity with the rest of the UI.
  const hourBars = metrics.peakHours
    .filter((h) => h.hour >= 7 && h.hour <= 22)
    .map((h) => ({
      label: formatTime12(`${String(h.hour).padStart(2, "0")}:00`, locale),
      value: h.count,
    }))

  // Daily series: show last 14 points to stay readable.
  const dayBars = metrics.dailyBookings.slice(-14).map((d) => ({
    label: d.date.slice(5),
    value: d.count,
  }))

  const tooltipProps = {
    contentStyle: {
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: "0.5rem",
      fontSize: "0.75rem",
      color: "var(--card-foreground)",
    },
    labelStyle: { color: "var(--muted-foreground)" },
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border p-1">
            {PERIODS.map((d) => (
              <button
                key={d}
                onClick={() => setPeriod(d)}
                className={cn(
                  "rounded px-3 py-1 text-sm transition-colors",
                  d === days
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent",
                )}
              >
                {t("lastDays", { n: d })}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={download} disabled={pending}>
            <Download className="size-4" />
            {t("exportCsv")}
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t(`kpi.${k.key}`)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Flagship: waitlist conversion / revenue saved */}
      <Card className="border-primary/40 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("waitlistTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-8">
          <div>
            <p className="text-3xl font-bold text-primary">
              {metrics.revenueSaved} SAR
            </p>
            <p className="text-sm text-muted-foreground">{t("revenueSaved")}</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">
              {metrics.waitlistConfirmed}/{metrics.waitlistJoined}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("waitlistConversion")} ({metrics.waitlistConversionRate}%)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("peakHours")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={hourBars}
                margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip cursor={{ fill: "var(--muted)" }} {...tooltipProps} />
                <Bar
                  dataKey="value"
                  fill="var(--primary)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("dailyBookings")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={dayBars}
                margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
              >
                <defs>
                  <linearGradient id="dailyFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--primary)"
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--primary)"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip {...tooltipProps} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#dailyFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top services */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("topServices")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {metrics.topServices.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("noData")}</p>
          )}
          {metrics.topServices.map((s, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="font-medium">{s.name}</span>
              <span className="text-muted-foreground">
                {t("bookingsCount", { n: s.count })} · {s.revenue} SAR
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Latest weekly AI report */}
      {aiReport && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t("aiReport")} · {aiReport.period}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {aiReport.recommendations}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
