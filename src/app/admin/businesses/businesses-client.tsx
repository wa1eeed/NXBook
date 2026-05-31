"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Search, X } from "lucide-react"
import {
  setBusinessActive,
  getBusinessDetails,
  type BusinessDetails,
} from "./actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { StatusBadge } from "@/components/admin/status-badge"
import { Building2 } from "lucide-react"
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
  const tt = useTranslations("transactions")
  const locale = useLocale()
  const reduce = useReducedMotion()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [query, setQuery] = useState("")
  const [planFilter, setPlanFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<BusinessDetails | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

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

  function openDetail(id: string) {
    setDetailId(id)
    setDetail(null)
    setLoadingDetail(true)
    void getBusinessDetails(id).then((d) => {
      setDetail(d)
      setLoadingDetail(false)
    })
  }

  function closeDetail() {
    setDetailId(null)
    setDetail(null)
  }

  const STATUS_TABS: { key: StatusFilter; label: string }[] = [
    { key: "all", label: t("filterAll") },
    { key: "active", label: t("filterActive") },
    { key: "trialing", label: t("filterTrialing") },
    { key: "inactive", label: t("filterInactive") },
  ]

  const dir = locale === "ar" ? "rtl" : "ltr"
  const panelX = locale === "ar" ? "-100%" : "100%"

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
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDetail(b.id)}
                            >
                              {t("details")}
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
                        onClick={() => openDetail(b.id)}
                      >
                        {t("details")}
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

      {/* Slide-over */}
      <AnimatePresence>
        {detailId && (
          <>
            <motion.div
              key="overlay"
              className="fixed inset-0 z-40 bg-black/40"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              onClick={closeDetail}
            />
            <motion.div
              key="panel"
              dir={dir}
              className="fixed inset-block-0 inset-inline-end-0 z-50 flex w-full max-w-md flex-col border-s border-border bg-background shadow-xl"
              initial={reduce ? false : { x: panelX }}
              animate={{ x: 0 }}
              exit={reduce ? undefined : { x: panelX }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="truncate text-lg font-semibold">
                  {detail?.name ?? "…"}
                </h2>
                <button
                  onClick={closeDetail}
                  aria-label={t("closePanel")}
                  className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {loadingDetail && (
                  <p className="text-sm text-muted-foreground">…</p>
                )}
                {detail && (
                  <div className="flex flex-col gap-6 text-sm">
                    <section className="flex flex-col gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("info")}
                      </h3>
                      <DetailRow label={t("title")} value={detail.name} />
                      <DetailRow label="slug" value={`/${detail.slug}`} mono />
                      <DetailRow label={t("type")} value={detail.type} />
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          {t("brandColor")}
                        </span>
                        <span className="flex items-center gap-2">
                          <span
                            className="size-4 rounded-full border border-border"
                            style={{ backgroundColor: detail.brandColor }}
                          />
                          <span className="font-mono text-xs">
                            {detail.brandColor}
                          </span>
                        </span>
                      </div>
                      <DetailRow label={t("locale")} value={detail.defaultLocale} />
                      <DetailRow
                        label={t("created")}
                        value={fmtDate(detail.createdAt, locale)}
                      />
                    </section>

                    <section className="flex flex-col gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("subscription")}
                      </h3>
                      <DetailRow label={t("plan")} value={detail.plan ?? "—"} />
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{t("status")}</span>
                        <StatusBadge
                          status={detail.status}
                          label={detail.status ?? undefined}
                        />
                      </div>
                      <DetailRow
                        label={t("trialEnds")}
                        value={fmtDate(detail.trialEndsAt, locale)}
                      />
                    </section>

                    <section className="flex flex-col gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("recentBookings")}
                      </h3>
                      {detail.recentBookings.length === 0 ? (
                        <p className="text-muted-foreground">{t("noBookings")}</p>
                      ) : (
                        detail.recentBookings.map((bk) => (
                          <div
                            key={bk.id}
                            className="flex items-center justify-between gap-2 border-b border-border/60 py-1.5 last:border-0"
                          >
                            <div className="min-w-0">
                              <p className="truncate">{bk.customer}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {bk.service} · {fmtDate(bk.date, locale)}
                              </p>
                            </div>
                            <StatusBadge status={bk.status} label={bk.status} />
                          </div>
                        ))
                      )}
                    </section>

                    <section className="flex flex-col gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {tt("title")}
                      </h3>
                      {detail.recentTransactions.length === 0 ? (
                        <p className="text-muted-foreground">{tt("empty")}</p>
                      ) : (
                        detail.recentTransactions.map((tx) => (
                          <div
                            key={tx.id}
                            className="flex items-center justify-between gap-2 border-b border-border/60 py-1.5 last:border-0"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium tabular-nums">
                                {tx.amount} SAR
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {tx.provider} · {fmtDate(tx.createdAt, locale)}
                              </p>
                            </div>
                            <StatusBadge status={tx.status} label={tx.status} />
                          </div>
                        ))
                      )}
                    </section>

                    <section className="flex flex-col gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("recentAudit")}
                      </h3>
                      {detail.recentAudit.length === 0 ? (
                        <p className="text-muted-foreground">{t("noAudit")}</p>
                      ) : (
                        detail.recentAudit.map((a) => (
                          <div
                            key={a.id}
                            className="border-b border-border/60 py-1.5 text-xs last:border-0"
                          >
                            <p className="font-medium">{a.action}</p>
                            <p className="text-muted-foreground">
                              {a.actor ?? "—"} · {fmtDate(a.createdAt, locale)}
                            </p>
                          </div>
                        ))
                      )}
                    </section>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function DetailRow({
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
