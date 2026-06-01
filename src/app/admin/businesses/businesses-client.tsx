"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { Building2, Search } from "lucide-react"
import { setBusinessActive } from "./actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { StatusBadge } from "@/components/admin/status-badge"
import { cn } from "@/lib/utils"

export interface BizRow {
  id: string
  name: string
  slug: string
  type: string
  isActive: boolean
  plan: string | null
  status: string | null
  trialEndsAt: string | null
  bookings: number
  bookingsThisMonth: number
  customers: number
  lastBookingAt: string | null
  createdAt: string
}

type StatusFilter = "all" | "active" | "trialing" | "inactive"

function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

// Days until a trial ends (negative = already past).
function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

export function BusinessesClient({ businesses }: { businesses: BizRow[] }) {
  const t = useTranslations("admin.businesses")
  const locale = useLocale()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [query, setQuery] = useState("")
  const [planFilter, setPlanFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  const plans = useMemo(
    () =>
      Array.from(
        new Set(businesses.map((b) => b.plan).filter((p): p is string => !!p)),
      ),
    [businesses],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return businesses.filter((b) => {
      if (q && !b.name.toLowerCase().includes(q) && !b.slug.toLowerCase().includes(q))
        return false
      if (planFilter !== "all" && b.plan !== planFilter) return false
      if (statusFilter === "active" && b.status !== "ACTIVE") return false
      if (statusFilter === "trialing" && b.status !== "TRIALING") return false
      if (statusFilter === "inactive" && b.isActive) return false
      return true
    })
  }, [businesses, query, planFilter, statusFilter])

  function toggle(id: string, isActive: boolean) {
    startTransition(async () => {
      await setBusinessActive(id, isActive)
      router.refresh()
    })
  }

  const STATUS_TABS: { key: StatusFilter; label: string }[] = [
    { key: "all", label: t("filterAll") },
    { key: "active", label: t("filterActive") },
    { key: "trialing", label: t("filterTrialing") },
    { key: "inactive", label: t("filterInactive") },
  ]

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>

      {/* Filters */}
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
        <div className="flex flex-wrap items-center gap-2">
          {plans.length > 0 && (
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">{t("filterPlan")}: {t("filterAll")}</option>
              {plans.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}
          <div className="flex rounded-md border border-input p-0.5">
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
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={businesses.length === 0 ? t("empty") : t("noResults")}
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden lg:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-start text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-start font-medium">{t("title")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("plan")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("status")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("trialEnds")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("bookingsCol")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("customers")}</th>
                    <th className="px-4 py-3 text-start font-medium">{t("lastActivity")}</th>
                    <th className="px-4 py-3 text-end font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((b) => {
                    const td = daysUntil(b.trialEndsAt)
                    const urgent =
                      b.status === "TRIALING" && td !== null && td < 3
                    return (
                      <tr key={b.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="font-medium">{b.name}</div>
                          <Link
                            href={`/${b.slug}`}
                            target="_blank"
                            className="font-mono text-xs text-muted-foreground hover:text-primary hover:underline"
                          >
                            /{b.slug}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {b.plan ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            status={b.isActive ? b.status : "INACTIVE"}
                            label={b.isActive ? b.status ?? undefined : t("inactive")}
                          />
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3",
                            urgent
                              ? "font-medium text-red-600 dark:text-red-400"
                              : "text-muted-foreground",
                          )}
                        >
                          {b.status === "TRIALING"
                            ? fmtDate(b.trialEndsAt, locale)
                            : "—"}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {b.bookings}{" "}
                          <span className="text-xs text-muted-foreground">
                            ({b.bookingsThisMonth} {t("bookingsThisMonth")})
                          </span>
                        </td>
                        <td className="px-4 py-3 tabular-nums">{b.customers}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {fmtDate(b.lastBookingAt, locale)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/admin/businesses/${b.id}`}>
                                {t("details")}
                              </Link>
                            </Button>
                            <Button
                              variant={b.isActive ? "outline" : "default"}
                              size="sm"
                              disabled={pending}
                              onClick={() => toggle(b.id, !b.isActive)}
                              className={cn(b.isActive && "text-destructive")}
                            >
                              {b.isActive ? t("deactivate") : t("activate")}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 lg:hidden">
            {filtered.map((b) => {
              const td = daysUntil(b.trialEndsAt)
              const urgent = b.status === "TRIALING" && td !== null && td < 3
              return (
                <Card key={b.id}>
                  <CardContent className="flex flex-col gap-3 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{b.name}</p>
                        <Link
                          href={`/${b.slug}`}
                          target="_blank"
                          className="font-mono text-xs text-muted-foreground hover:text-primary hover:underline"
                        >
                          /{b.slug}
                        </Link>
                      </div>
                      <StatusBadge
                        status={b.isActive ? b.status : "INACTIVE"}
                        label={b.isActive ? b.status ?? undefined : t("inactive")}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span>{b.plan ?? "—"}</span>
                      <span>
                        {t("bookingsCol")}: {b.bookings} ({b.bookingsThisMonth})
                      </span>
                      {b.status === "TRIALING" && (
                        <span className={cn(urgent && "font-medium text-red-600 dark:text-red-400")}>
                          {t("trialEnds")}: {fmtDate(b.trialEndsAt, locale)}
                        </span>
                      )}
                      <span>
                        {t("lastActivity")}: {fmtDate(b.lastBookingAt, locale)}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        asChild
                      >
                        <Link href={`/admin/businesses/${b.id}`}>
                          {t("details")}
                        </Link>
                      </Button>
                      <Button
                        variant={b.isActive ? "outline" : "default"}
                        size="sm"
                        className={cn("flex-1", b.isActive && "text-destructive")}
                        disabled={pending}
                        onClick={() => toggle(b.id, !b.isActive)}
                      >
                        {b.isActive ? t("deactivate") : t("activate")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}

    </div>
  )
}
