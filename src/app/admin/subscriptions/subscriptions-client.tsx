"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface SubscriptionRow {
  id: string
  businessId: string
  businessName: string
  planName: string
  priceMonthly: number
  status: string
  cancelAtPeriodEnd: boolean
  trialEndsAt: string | null
  currentPeriodEnd: string
}

const STATUS_FILTERS = ["all", "ACTIVE", "TRIALING", "PAST_DUE", "CANCELLED"] as const

const STATUS_BG: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  TRIALING: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  PAST_DUE: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
}

export function SubscriptionsClient({ rows }: { rows: SubscriptionRow[] }) {
  const t = useTranslations("admin.subscriptions")
  const locale = useLocale()
  const [filter, setFilter] = useState<string>("all")
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false
      if (q && !r.businessName.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, filter, query])

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
      day: "numeric", month: "short", year: "numeric",
    })

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {f === "all" ? t("filterAll") : t(`status.${f}`)}
            </button>
          ))}
        </div>
        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            className="h-9 ps-8 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 text-start font-medium">{t("colBusiness")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("colPlan")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("colStatus")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("colRenewal")}</th>
                <th className="px-4 py-3 text-end font-medium">{t("colMrr")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/businesses/${r.businessId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {r.businessName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.planName}</td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", STATUS_BG[r.status] ?? "")}>
                      {t(`status.${r.status}`)}
                    </span>
                    {r.cancelAtPeriodEnd && (
                      <span className="ms-1 text-[10px] text-amber-600 dark:text-amber-400">
                        {t("ending")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">
                    {r.status === "TRIALING" && r.trialEndsAt
                      ? `${t("trialEnds")} ${fmtDate(r.trialEndsAt)}`
                      : fmtDate(r.currentPeriodEnd)}
                  </td>
                  <td className="px-4 py-3 text-end font-medium tabular-nums">
                    {r.status === "ACTIVE" ? `${r.priceMonthly} SAR` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
