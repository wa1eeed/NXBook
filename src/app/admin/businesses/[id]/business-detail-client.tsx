"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Users,
  DollarSign,
  ClipboardList,
  ChevronDown,
} from "lucide-react"
import {
  setBusinessActiveAction,
  changePlanAction,
  extendTrialAction,
} from "./actions"
import type { BusinessDetailData } from "./data"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { StatusBadge } from "@/components/admin/status-badge"
import { BarChart } from "@/components/dashboard/bar-chart"
import { cn } from "@/lib/utils"
import { formatTime12 } from "@/lib/time"

type Tab = "overview" | "bookings" | "customers" | "revenue" | "audit"

function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function KpiCard({
  title,
  value,
  icon: Icon,
}: {
  title: string
  value: string | number
  icon: React.ElementType
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="size-5 text-primary" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-xl font-bold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 transition-colors",
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

export function BusinessDetailClient({ data }: { data: BusinessDetailData }) {
  const t = useTranslations("admin.bizDetail")
  const locale = useLocale()
  const [tab, setTab] = useState<Tab>("overview")
  const [bookingFilter, setBookingFilter] = useState("ALL")
  const [pending, startTransition] = useTransition()
  const [showPlanPicker, setShowPlanPicker] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState(data.planId ?? "")

  function handleToggleActive() {
    const next = !data.isActive
    startTransition(async () => {
      const res = await setBusinessActiveAction(data.id, next)
      if (res.ok) {
        toast.success(next ? t("activated") : t("deactivated"))
      } else {
        toast.error(t("actionFailed"))
      }
    })
  }

  function handleChangePlan() {
    if (!selectedPlanId) return
    startTransition(async () => {
      const res = await changePlanAction(data.id, selectedPlanId)
      if (res.ok) {
        toast.success(t("planChanged"))
        setShowPlanPicker(false)
      } else {
        toast.error(t("actionFailed"))
      }
    })
  }

  function handleExtendTrial(days: number) {
    startTransition(async () => {
      const res = await extendTrialAction(data.id, days)
      if (res.ok) {
        toast.success(t("trialExtended", { days }))
      } else {
        toast.error(t("actionFailed"))
      }
    })
  }

  // Filtered bookings for the bookings tab
  const filteredBookings =
    bookingFilter === "ALL"
      ? data.bookings
      : data.bookings.filter((b) => b.status === bookingFilter)

  // Attendance rate
  const attended = data.bookings.filter(
    (b) => b.status === "ATTENDED",
  ).length
  const done = data.bookings.filter((b) =>
    ["ATTENDED", "NO_SHOW"].includes(b.status),
  ).length
  const attendanceRate =
    done > 0 ? Math.round((attended / done) * 100) : null

  const BOOKING_FILTERS = [
    { key: "ALL", label: t("bookingsFilterAll") },
    { key: "PENDING", label: t("bookingsFilterPending") },
    { key: "CONFIRMED", label: t("bookingsFilterConfirmed") },
    { key: "ATTENDED", label: t("bookingsFilterAttended") },
    { key: "NO_SHOW", label: t("bookingsFilterNoShow") },
    { key: "CANCELLED", label: t("bookingsFilterCancelled") },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/admin/businesses"
          className="flex items-center gap-1 hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t("breadcrumb")}
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{data.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-muted">
            <Building2 className="size-6 text-muted-foreground" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{data.name}</h1>
              <StatusBadge
                status={data.isActive ? data.subscriptionStatus : "INACTIVE"}
                label={
                  data.isActive
                    ? (data.subscriptionStatus ?? t("statusActive"))
                    : t("statusInactive")
                }
              />
            </div>
            <p className="mt-0.5 font-mono text-sm text-muted-foreground">
              /{data.slug}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={data.isActive ? "outline" : "default"}
            size="sm"
            disabled={pending}
            onClick={handleToggleActive}
            className={cn(data.isActive && "text-destructive")}
          >
            {data.isActive ? t("deactivate") : t("activate")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => handleExtendTrial(14)}
            title={t("extendTrialHint")}
          >
            {t("extendTrial")}
          </Button>
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPlanPicker((v) => !v)}
            >
              {t("changePlan")} <ChevronDown className="ms-1 size-3.5" />
            </Button>
            {showPlanPicker && (
              <div className="absolute end-0 top-full z-20 mt-1 min-w-56 rounded-lg border border-border bg-background p-3 shadow-lg">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {t("changePlanTitle")}
                </p>
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="mb-3 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                >
                  <option value="">—</option>
                  {data.allPlans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameEn} ({p.tier})
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  className="w-full"
                  disabled={!selectedPlanId || pending}
                  onClick={handleChangePlan}
                >
                  {t("changePlanConfirm")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          title={t("kpiBookingsMonth")}
          value={data.bookingsThisMonth}
          icon={CalendarDays}
        />
        <KpiCard
          title={t("kpiCustomers")}
          value={data.totalCustomers}
          icon={Users}
        />
        <KpiCard
          title={t("kpiRevenue")}
          value={`${Math.round(data.totalRevenue)} SAR`}
          icon={DollarSign}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex overflow-x-auto">
          {(
            [
              ["overview", t("tabOverview")],
              ["bookings", t("tabBookings")],
              ["customers", t("tabCustomers")],
              ["revenue", t("tabRevenue")],
              ["audit", t("tabAudit")],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <TabBtn key={key} active={tab === key} onClick={() => setTab(key)}>
              {label}
            </TabBtn>
          ))}
        </div>
      </div>

      {/* Tab: Overview */}
      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Business info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("tabOverview")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <Row label={t("type")} value={data.type} />
              <Row label={t("slug")} value={`/${data.slug}`} mono />
              <Row label={t("locale")} value={data.defaultLocale} />
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{t("brandColor")}</span>
                <span className="flex items-center gap-2">
                  <span
                    className="size-4 rounded-full border border-border"
                    style={{ backgroundColor: data.brandColor }}
                  />
                  <span className="font-mono text-xs">{data.brandColor}</span>
                </span>
              </div>
              <Row label={t("created")} value={fmtDate(data.createdAt, locale)} />
            </CardContent>
          </Card>

          {/* Subscription */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("subscriptionStatus")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <Row label={t("plan")} value={data.planName ?? "—"} />
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{t("subscriptionStatus")}</span>
                <StatusBadge
                  status={data.subscriptionStatus}
                  label={data.subscriptionStatus ?? "—"}
                />
              </div>
              <Row
                label={t("trialEnds")}
                value={fmtDate(data.trialEndsAt, locale)}
              />
              <Row
                label={t("periodEnd")}
                value={fmtDate(data.currentPeriodEnd, locale)}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Bookings */}
      {tab === "bookings" && (
        <div className="flex flex-col gap-4">
          {attendanceRate !== null && (
            <p className="text-sm text-muted-foreground">
              {t("bookingsAttendanceRate")}:{" "}
              <span className="font-medium text-foreground">{attendanceRate}%</span>
            </p>
          )}
          {/* Filter pills */}
          <div className="flex flex-wrap gap-2">
            {BOOKING_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setBookingFilter(f.key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  bookingFilter === f.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredBookings.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title={t("bookingsEmpty")}
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-start font-medium">
                        {t("bookingsDate")}
                      </th>
                      <th className="px-4 py-3 text-start font-medium">
                        {t("bookingsTime")}
                      </th>
                      <th className="px-4 py-3 text-start font-medium">
                        {t("bookingsCustomer")}
                      </th>
                      <th className="px-4 py-3 text-start font-medium">
                        {t("bookingsService")}
                      </th>
                      <th className="px-4 py-3 text-start font-medium">
                        {t("bookingsStaff")}
                      </th>
                      <th className="px-4 py-3 text-start font-medium">
                        {t("bookingsStatus")}
                      </th>
                      <th className="px-4 py-3 text-end font-medium">
                        {t("bookingsAmount")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredBookings.map((b) => (
                      <tr key={b.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 text-muted-foreground">
                          {fmtDate(b.date, locale)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs tabular-nums">
                          {formatTime12(b.startTime, locale)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{b.customerName}</div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {b.customerPhone}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {b.serviceName}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {b.staffName ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={b.status} label={b.status} />
                        </td>
                        <td className="px-4 py-3 text-end tabular-nums">
                          {b.amount != null ? `${b.amount} SAR` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Tab: Customers */}
      {tab === "customers" && (
        <div className="flex flex-col gap-4">
          {data.customers.length === 0 ? (
            <EmptyState icon={Users} title={t("customersEmpty")} />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-start font-medium">
                        {t("customersName")}
                      </th>
                      <th className="px-4 py-3 text-start font-medium">
                        {t("customersBookings")}
                      </th>
                      <th className="px-4 py-3 text-start font-medium">
                        {t("customersSpent")}
                      </th>
                      <th className="px-4 py-3 text-start font-medium">
                        {t("customersNoShow")}
                      </th>
                      <th className="px-4 py-3 text-start font-medium">
                        {t("customersLoyalty")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.customers.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                              {c.name.trim()[0]?.toUpperCase() ?? "?"}
                            </span>
                            <div>
                              <div className="flex items-center gap-1.5 font-medium">
                                {c.name}
                                {c.isVIP && (
                                  <span className="rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                    {t("customersVip")}
                                  </span>
                                )}
                              </div>
                              <div className="font-mono text-xs text-muted-foreground">
                                {c.phone}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {c.bookingsCount}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {Math.round(c.totalSpent)} SAR
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-red-500"
                                style={{
                                  inlineSize: `${Math.min(100, (c.noShowScore / 5) * 100)}%`,
                                }}
                              />
                            </div>
                            <span className="tabular-nums text-xs text-muted-foreground">
                              {c.noShowScore.toFixed(1)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">
                          {c.loyaltyScore.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Tab: Revenue */}
      {tab === "revenue" && (
        <div className="flex flex-col gap-6">
          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="py-5">
                <p className="text-xs text-muted-foreground">
                  {t("revenueTotal")}
                </p>
                <p className="text-2xl font-bold tabular-nums">
                  {Math.round(data.revenueKpis.totalRevenue)} SAR
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-5">
                <p className="text-xs text-muted-foreground">
                  {t("revenueSuccessful")}
                </p>
                <p className="text-2xl font-bold tabular-nums">
                  {data.revenueKpis.successfulCount}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-5">
                <p className="text-xs text-muted-foreground">
                  {t("revenuePending")}
                </p>
                <p className="text-2xl font-bold tabular-nums">
                  {data.revenueKpis.pendingCount}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Bar chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("revenueChart")}</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart
                bars={data.monthlyRevenue.map((m) => ({
                  label: m.label,
                  value: m.value,
                  sub: `${Math.round(m.value)} SAR`,
                }))}
              />
            </CardContent>
          </Card>

          {/* Last 10 transactions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("revenueTransactions")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.recentTransactions.length === 0 ? (
                <div className="px-4 py-6">
                  <EmptyState
                    icon={DollarSign}
                    title={t("revenueEmpty")}
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-start font-medium">
                          {t("revenueCustomer")}
                        </th>
                        <th className="px-4 py-3 text-start font-medium">
                          {t("revenueDate")}
                        </th>
                        <th className="px-4 py-3 text-start font-medium">
                          {t("revenueProvider")}
                        </th>
                        <th className="px-4 py-3 text-start font-medium">
                          {t("revenueStatus")}
                        </th>
                        <th className="px-4 py-3 text-end font-medium">
                          {t("revenueAmount")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.recentTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            {tx.customerName ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {fmtDate(tx.createdAt, locale)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {tx.provider}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={tx.status} label={tx.status} />
                          </td>
                          <td className="px-4 py-3 text-end tabular-nums font-medium">
                            {tx.amount} SAR
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Audit & Agents */}
      {tab === "audit" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Audit log */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("auditTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.auditLogs.length === 0 ? (
                <div className="px-4 py-6">
                  <EmptyState
                    icon={ClipboardList}
                    title={t("auditEmpty")}
                  />
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {data.auditLogs.map((a) => (
                    <li key={a.id} className="px-4 py-3 text-sm">
                      <div className="font-medium">{a.action}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{a.actorEmail ?? a.actorId ?? "—"}</span>
                        <span>·</span>
                        <span>{fmtDate(a.createdAt, locale)}</span>
                      </div>
                      {a.metadata && (
                        <div className="mt-1 rounded bg-muted/40 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                          {a.metadata}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-6">
            {/* Agents */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("agentsTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {data.agents.length === 0 ? (
                  <div className="px-4 py-6">
                    <EmptyState
                      icon={Building2}
                      title={t("agentsEmpty")}
                    />
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {data.agents.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                      >
                        <div>
                          <div className="font-medium">{a.type}</div>
                          <div className="text-xs text-muted-foreground">
                            {a.totalRuns} runs ·{" "}
                            {fmtDate(a.lastRunAt, locale)}
                          </div>
                        </div>
                        <StatusBadge
                          status={a.isActive ? "ACTIVE" : "INACTIVE"}
                          label={
                            a.isActive ? t("agentsActive") : t("statusInactive")
                          }
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Payment gateway */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("gatewayTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                {data.gateway ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t("gatewayProvider")}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{data.gateway.provider}</span>
                      <StatusBadge
                        status="ACTIVE"
                        label={t("gatewayActive")}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("gatewayNone")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-end", mono && "font-mono text-xs")}>{value}</span>
    </div>
  )
}
