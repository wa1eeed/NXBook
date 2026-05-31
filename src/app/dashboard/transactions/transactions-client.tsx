"use client"

// Tenant transactions ledger UI: KPI cards, status/provider filters,
// and a table (desktop) / card list (mobile) with refund + details.
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Banknote, CheckCircle2, RefreshCcw, TrendingUp, Receipt } from "lucide-react"
import { refundTransactionAction } from "./actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { cn } from "@/lib/utils"

export interface TransactionRow {
  id: string
  shortId: string
  customerName: string | null
  serviceName: string | null
  amount: number
  currency: string
  provider: string
  providerRef: string | null
  status: string
  type: string
  createdAt: string
  bookingId: string | null
}

export interface TransactionKpis {
  revenueThisMonth: number
  successful: number
  refunds: number
  avgBooking: number
}

type StatusFilter = "all" | "PAID" | "PENDING" | "FAILED" | "REFUNDED"

const STATUS_STYLE: Record<string, string> = {
  PAID: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  REFUNDED: "bg-muted text-muted-foreground",
}

const PROVIDER_STYLE: Record<string, string> = {
  NXBOOK_PAY: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  MOYASAR: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  TAP: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  PAYTABS: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
}

export function TransactionsClient({
  rows,
  kpis,
}: {
  rows: TransactionRow[]
  kpis: TransactionKpis
}) {
  const t = useTranslations("transactions")
  const locale = useLocale()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [providerFilter, setProviderFilter] = useState("all")
  const [openDetails, setOpenDetails] = useState<string | null>(null)

  const providers = useMemo(
    () => Array.from(new Set(rows.map((r) => r.provider))),
    [rows],
  )

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false
        if (providerFilter !== "all" && r.provider !== providerFilter) return false
        return true
      }),
    [rows, statusFilter, providerFilter],
  )

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleString(locale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  function refund(id: string) {
    if (!window.confirm(t("refundConfirm"))) return
    startTransition(async () => {
      const res = await refundTransactionAction(id)
      if (res.ok) {
        toast.success(t("toast.refunded"))
        router.refresh()
      } else {
        toast.error(t(`error.${res.error}`))
      }
    })
  }

  const STATUS_TABS: { key: StatusFilter; label: string }[] = [
    { key: "all", label: t("filterAll") },
    { key: "PAID", label: t("filterPaid") },
    { key: "PENDING", label: t("filterPending") },
    { key: "FAILED", label: t("filterFailed") },
    { key: "REFUNDED", label: t("filterRefunded") },
  ]

  const kpiCards = [
    { key: "revenue", icon: Banknote, value: `${Math.round(kpis.revenueThisMonth)} SAR` },
    { key: "successful", icon: CheckCircle2, value: kpis.successful.toString() },
    { key: "refunds", icon: RefreshCcw, value: kpis.refunds.toString() },
    { key: "avgBooking", icon: TrendingUp, value: `${Math.round(kpis.avgBooking)} SAR` },
  ] as const

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((c) => (
          <Card key={c.key} className="transition-shadow hover:shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t(`kpi.${c.key}`)}
              </CardTitle>
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <c.icon className="size-5" />
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap rounded-md border border-input p-0.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {providers.length > 0 && (
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">{t("allProviders")}</option>
            {providers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={rows.length === 0 ? t("empty") : t("filterAll")}
          description={rows.length === 0 ? t("emptyDesc") : undefined}
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden lg:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-start font-medium">{t("shortId")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("customer")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("service")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("amount")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("provider")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("status")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("date")}</th>
                    <th className="px-4 py-3 text-end font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((r) => (
                    <tr key={r.id} className="align-top hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setOpenDetails(openDetails === r.id ? null : r.id)}
                          className="font-mono text-xs hover:text-primary hover:underline"
                        >
                          #{r.shortId}
                        </button>
                        {openDetails === r.id && (
                          <div className="mt-2 rounded-md bg-muted/50 p-2 text-xs">
                            <p dir="ltr" className="break-all font-mono">
                              {r.providerRef ?? "—"}
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">{r.customerName ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {r.serviceName ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-medium tabular-nums">
                        {r.amount} {r.currency}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            PROVIDER_STYLE[r.provider] ?? "bg-muted text-muted-foreground",
                          )}
                        >
                          {r.provider}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            STATUS_STYLE[r.status] ?? "bg-muted text-muted-foreground",
                          )}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.createdAt)}</td>
                      <td className="px-4 py-3 text-end">
                        {r.status === "PAID" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pending}
                            onClick={() => refund(r.id)}
                          >
                            {t("refund")}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 lg:hidden">
            {filtered.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex flex-col gap-2 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{r.customerName ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.serviceName ?? "—"} · {fmtDate(r.createdAt)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        STATUS_STYLE[r.status] ?? "bg-muted text-muted-foreground",
                      )}
                    >
                      {r.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold tabular-nums">
                      {r.amount} {r.currency}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        PROVIDER_STYLE[r.provider] ?? "bg-muted text-muted-foreground",
                      )}
                    >
                      {r.provider}
                    </span>
                  </div>
                  <p dir="ltr" className="break-all font-mono text-xs text-muted-foreground">
                    #{r.shortId} · {r.providerRef ?? "—"}
                  </p>
                  {r.status === "PAID" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="self-start"
                      disabled={pending}
                      onClick={() => refund(r.id)}
                    >
                      {t("refund")}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
