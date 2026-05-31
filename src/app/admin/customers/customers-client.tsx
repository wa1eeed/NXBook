"use client"

import { useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Search, UsersRound } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { cn } from "@/lib/utils"

export interface CustomerRow {
  id: string
  name: string
  phone: string
  businessName: string
  totalBookings: number
  totalSpent: number
  lastVisitAt: string | null
  noShowScore: number
  loyaltyScore: number
  isVIP: boolean
  isBlocked: boolean
}

type Filter = "all" | "vip" | "blocked" | "highNoShow"

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
}

function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function CustomersClient({ customers }: { customers: CustomerRow[] }) {
  const t = useTranslations("admin.customers")
  const locale = useLocale()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return customers.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q) && !c.phone.includes(q))
        return false
      if (filter === "vip" && !c.isVIP) return false
      if (filter === "blocked" && !c.isBlocked) return false
      if (filter === "highNoShow" && c.noShowScore <= 2) return false
      return true
    })
  }, [customers, query, filter])

  const TABS: { key: Filter; label: string }[] = [
    { key: "all", label: t("filterAll") },
    { key: "vip", label: t("filterVIP") },
    { key: "blocked", label: t("filterBlocked") },
    { key: "highNoShow", label: t("filterHighNoShow") },
  ]

  // No-show bar capped at 5 for the visual scale.
  const noShowPct = (s: number) => Math.min(100, (s / 5) * 100)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute inset-inline-start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="ps-9"
          />
        </div>
        <div className="flex rounded-md border border-input p-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                filter === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title={customers.length === 0 ? t("empty") : t("noResults")}
          description={customers.length === 0 ? t("emptyDesc") : undefined}
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden lg:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-start font-medium">{t("title")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("business")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("bookings")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("spent")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("lastVisit")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("noShowScore")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("loyaltyScore")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {initials(c.name)}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate font-medium">{c.name}</span>
                              {c.isVIP && (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                  {t("vip")}
                                </span>
                              )}
                              {c.isBlocked && (
                                <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
                                  {t("blocked")}
                                </span>
                              )}
                            </div>
                            <p className="truncate font-mono text-xs text-muted-foreground">
                              {c.phone}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                          {c.businessName}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{c.totalBookings}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {Math.round(c.totalSpent)} SAR
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {fmtDate(c.lastVisitAt, locale)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-red-500"
                              style={{ inlineSize: `${noShowPct(c.noShowScore)}%` }}
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

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 lg:hidden">
            {filtered.map((c) => (
              <Card key={c.id}>
                <CardContent className="flex flex-col gap-3 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {initials(c.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium">{c.name}</span>
                        {c.isVIP && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            {t("vip")}
                          </span>
                        )}
                        {c.isBlocked && (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
                            {t("blocked")}
                          </span>
                        )}
                      </div>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {c.phone}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>{t("business")}: {c.businessName}</span>
                    <span>{t("bookings")}: {c.totalBookings}</span>
                    <span>{t("spent")}: {Math.round(c.totalSpent)} SAR</span>
                    <span>{t("lastVisit")}: {fmtDate(c.lastVisitAt, locale)}</span>
                    <span>{t("noShowScore")}: {c.noShowScore.toFixed(1)}</span>
                    <span>{t("loyaltyScore")}: {c.loyaltyScore.toFixed(1)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
