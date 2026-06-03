"use client"

// ============================================================
// Customer detail page — 4 tabs: Profile / Timeline /
// Bookings / Statistics.  All mutations use server actions
// from the parent customers/actions.ts, re-executed here.
// ============================================================

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { motion, AnimatePresence } from "motion/react"
import {
  ArrowLeft,
  Star,
  Ban,
  Phone,
  Mail,
  Calendar,
  Clock,
  TrendingUp,
  AlertTriangle,
  CreditCard,
  Users,
  Plus,
  ChevronRight,
  CheckCircle2,
  XCircle,
  TimerIcon,
  Hourglass,
} from "lucide-react"
import {
  setCustomerBlocked,
  setCustomerVIP,
  updateCustomerNotes,
} from "../actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { formatTime12 } from "@/lib/time"
import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────

interface CustomerDetail {
  id: string
  name: string
  phone: string
  email: string | null
  notes: string | null
  isBlocked: boolean
  blockReason: string | null
  isVIP: boolean
  noShowScore: number
  loyaltyScore: number
  totalBookings: number
  totalNoShows: number
  totalSpent: number
  lastVisitAt: string | null
  createdAt: string
}

interface DetailBooking {
  id: string
  date: string
  startTime: string
  endTime: string
  status: string
  serviceName: string
  staffName: string | null
  notes: string | null
  paymentStatus: string | null
  paymentAmount: number | null
}

export interface TimelineEvent {
  id: string
  type:
    | "booking_created"
    | "booking_confirmed"
    | "booking_attended"
    | "booking_noshow"
    | "booking_cancelled"
    | "waitlist_joined"
    | "waitlist_offered"
    | "waitlist_confirmed"
    | "payment"
  timestamp: string
  serviceName: string
  amount?: number | null
  notes?: string | null
}

interface TopService { name: string; count: number }
interface MonthPoint { label: string; count: number }

// ─── Status helpers ───────────────────────────────────────────

const STATUS_BG: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  CONFIRMED: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  ATTENDED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  NO_SHOW: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  CANCELLED: "bg-muted text-muted-foreground",
}

const STATUS_KEY: Record<string, string> = {
  PENDING: "filterPending",
  CONFIRMED: "filterConfirmed",
  ATTENDED: "filterAttended",
  NO_SHOW: "filterNoShow",
  CANCELLED: "filterCancelled",
}

// ─── Timeline event meta ──────────────────────────────────────

function eventMeta(type: TimelineEvent["type"], tc: ReturnType<typeof useTranslations>) {
  const map: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    booking_created: { icon: <Calendar className="size-3.5" />, label: tc("custTimelineBookingCreated"), color: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300" },
    booking_confirmed: { icon: <CheckCircle2 className="size-3.5" />, label: tc("custTimelineConfirmed"), color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300" },
    booking_attended: { icon: <CheckCircle2 className="size-3.5" />, label: tc("custTimelineAttended"), color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200" },
    booking_noshow: { icon: <XCircle className="size-3.5" />, label: tc("custTimelineNoShow"), color: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300" },
    booking_cancelled: { icon: <XCircle className="size-3.5" />, label: tc("custTimelineCancelled"), color: "bg-muted text-muted-foreground" },
    waitlist_joined: { icon: <Hourglass className="size-3.5" />, label: tc("custTimelineWaitlistJoined"), color: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300" },
    waitlist_offered: { icon: <TimerIcon className="size-3.5" />, label: tc("custTimelineWaitlistOffered"), color: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300" },
    waitlist_confirmed: { icon: <CheckCircle2 className="size-3.5" />, label: tc("custTimelineWaitlistConfirmed"), color: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300" },
    payment: { icon: <CreditCard className="size-3.5" />, label: tc("custTimelinePayment"), color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  }
  return map[type] ?? map["booking_created"]
}

function relativeTime(iso: string, locale: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  const fmt = (n: number, unit: string) =>
    locale === "ar"
      ? `منذ ${n} ${unit}`
      : `${n} ${unit} ago`
  if (mins < 60) return fmt(mins || 1, locale === "ar" ? "دقيقة" : "min")
  if (hours < 24) return fmt(hours, locale === "ar" ? "ساعة" : "hr")
  if (days < 30) return fmt(days, locale === "ar" ? "يوم" : "day")
  return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
    day: "numeric", month: "short", year: "numeric",
  })
}

// ─── Score bar ────────────────────────────────────────────────

function ScoreBar({ label, score, max = 10, color }: { label: string; score: number; max?: number; color: string }) {
  const pct = Math.min(100, (score / max) * 100)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">{score.toFixed(1)} / {max}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className={cn("h-full rounded-full", color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  )
}

// ─── KPI card ─────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ─── Simple bar chart ─────────────────────────────────────────

function SimpleBarChart({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className="flex h-24 items-end gap-1">
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
          <motion.div
            className="w-full rounded-t bg-primary/70"
            initial={{ height: 0 }}
            animate={{ height: `${(d.count / max) * 80}px` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
          <span className="text-[9px] text-muted-foreground">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────

type Tab = "profile" | "timeline" | "bookings" | "stats"

export function CustomerDetailClient({
  customer,
  bookings,
  timeline,
  topServices,
  monthlyTrend,
}: {
  customer: CustomerDetail
  bookings: DetailBooking[]
  timeline: TimelineEvent[]
  topServices: TopService[]
  monthlyTrend: MonthPoint[]
}) {
  const t = useTranslations("customers")
  const tb = useTranslations("bookings")
  const ts = useTranslations("status")
  const locale = useLocale()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [tab, setTab] = useState<Tab>("profile")
  const [notes, setNotes] = useState(customer.notes ?? "")
  const [editingNotes, setEditingNotes] = useState(false)
  const [bookingFilter, setBookingFilter] = useState("")
  const [tlFilter, setTlFilter] = useState<TimelineEvent["type"] | "all">("all")

  function run<T>(fn: () => Promise<T>, successMsg: string) {
    startTransition(async () => {
      await fn()
      toast.success(successMsg)
      router.refresh()
    })
  }

  const avgSpend =
    customer.totalBookings > 0
      ? (customer.totalSpent / customer.totalBookings).toFixed(1)
      : "0"

  const filteredBookings = bookings.filter((b) =>
    !bookingFilter ||
    b.serviceName.toLowerCase().includes(bookingFilter.toLowerCase()) ||
    b.status.toLowerCase().includes(bookingFilter.toLowerCase()),
  )

  const filteredTimeline =
    tlFilter === "all" ? timeline : timeline.filter((e) => e.type === tlFilter)

  const tabs: { key: Tab; label: string }[] = [
    { key: "profile", label: t("custTabProfile") },
    { key: "timeline", label: t("custTabTimeline") },
    { key: "bookings", label: t("custTabBookings") },
    { key: "stats", label: t("custTabStats") },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard/customers" className="hover:text-foreground transition-colors">
          {t("title")}
        </Link>
        <ChevronRight className="size-3.5 rtl:rotate-180" />
        <span className="text-foreground font-medium">{customer.name}</span>
      </div>

      {/* Header card */}
      <Card className="shadow-soft">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-2xl font-bold text-primary">
                {customer.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold">{customer.name}</h1>
                  {customer.isVIP && (
                    <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      <Star className="size-3 fill-amber-400 text-amber-400" />
                      VIP
                    </span>
                  )}
                  {customer.isBlocked && (
                    <span className="flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-900/40 dark:text-red-300">
                      <Ban className="size-3" />
                      {t("blocked")}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Phone className="size-3.5" />
                    <span dir="ltr">{customer.phone}</span>
                  </span>
                  {customer.email && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="size-3.5" />
                      {customer.email}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Calendar className="size-3.5" />
                    {t("custSince")} {new Date(customer.createdAt).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { month: "short", year: "numeric" })}
                  </span>
                </div>
              </div>
            </div>
            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" asChild>
                <Link href={`/dashboard/bookings/new?customerId=${customer.id}`}>
                  <Plus className="size-4" />
                  {t("newBookingForCustomer")}
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => setCustomerVIP(customer.id, !customer.isVIP), t("saved"))}
              >
                <Star className={cn("size-4", customer.isVIP && "fill-amber-400 text-amber-400")} />
                {customer.isVIP ? t("removeVIP") : t("markVIP")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(() => setCustomerBlocked(customer.id, !customer.isBlocked), t("saved"))
                }
              >
                <Ban className={cn("size-4", customer.isBlocked && "text-destructive")} />
                {customer.isBlocked ? t("unblock") : t("block")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-0">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                tab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {/* ─── Profile tab ─── */}
          {tab === "profile" && (
            <div className="grid gap-6 md:grid-cols-2">
              {/* KPIs */}
              <div className="grid grid-cols-2 gap-3">
                <KpiCard
                  icon={<Calendar className="size-4" />}
                  label={t("custKpiTotal")}
                  value={customer.totalBookings}
                />
                <KpiCard
                  icon={<CreditCard className="size-4" />}
                  label={t("custKpiSpent")}
                  value={`${customer.totalSpent.toFixed(0)} SAR`}
                />
                <KpiCard
                  icon={<TrendingUp className="size-4" />}
                  label={t("custKpiAvgSpend")}
                  value={`${avgSpend} SAR`}
                />
                <KpiCard
                  icon={<Clock className="size-4" />}
                  label={t("custKpiLastVisit")}
                  value={
                    customer.lastVisitAt
                      ? new Date(customer.lastVisitAt).toLocaleDateString(
                          locale === "ar" ? "ar-SA" : "en-US",
                          { month: "short", day: "numeric" },
                        )
                      : "—"
                  }
                />
              </div>

              {/* Scores + notes */}
              <div className="flex flex-col gap-4">
                <Card>
                  <CardContent className="p-4 flex flex-col gap-4">
                    <ScoreBar
                      label={t("noShowScore")}
                      score={customer.noShowScore}
                      max={10}
                      color="bg-red-400"
                    />
                    <ScoreBar
                      label={t("loyaltyScore")}
                      score={customer.loyaltyScore}
                      max={20}
                      color="bg-emerald-500"
                    />
                  </CardContent>
                </Card>

                {/* Internal notes */}
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{t("internalNotes")}</CardTitle>
                      <button
                        type="button"
                        onClick={() => setEditingNotes(!editingNotes)}
                        className="text-xs text-primary hover:underline"
                      >
                        {editingNotes ? t("cancel") : t("edit")}
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    {editingNotes ? (
                      <div className="flex flex-col gap-2">
                        <Textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={4}
                          className="text-sm"
                        />
                        <Button
                          size="sm"
                          disabled={pending}
                          onClick={() => {
                            startTransition(async () => {
                              await updateCustomerNotes(customer.id, notes)
                              toast.success(t("saved"))
                              setEditingNotes(false)
                              router.refresh()
                            })
                          }}
                        >
                          {t("saveNotes")}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {notes || t("noNotes")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* ─── Timeline tab ─── */}
          {tab === "timeline" && (
            <div className="flex flex-col gap-4">
              {/* Type filter */}
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["all", t("custTlAll")],
                    ["booking_created", t("custTlBookings")],
                    ["booking_attended", t("custTlAttended")],
                    ["waitlist_joined", t("custTlWaitlist")],
                    ["payment", t("custTlPayments")],
                  ] as [TimelineEvent["type"] | "all", string][]
                ).map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTlFilter(type)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                      tlFilter === type
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {filteredTimeline.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </div>
              ) : (
                <div className="relative flex flex-col gap-0">
                  <div className="absolute start-[19px] top-2 bottom-2 w-px bg-border/60" />
                  {filteredTimeline.map((ev, i) => {
                    const meta = eventMeta(ev.type, t)
                    return (
                      <motion.div
                        key={ev.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.025 }}
                        className="flex items-start gap-3 pb-4"
                      >
                        {/* Icon */}
                        <span className={cn("relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full", meta.color)}>
                          {meta.icon}
                        </span>
                        {/* Content */}
                        <div className="min-w-0 flex-1 pt-1.5">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-sm font-semibold">{meta.label}</span>
                            {ev.serviceName && (
                              <span className="text-xs text-muted-foreground">— {ev.serviceName}</span>
                            )}
                            {ev.amount != null && (
                              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                {ev.amount} SAR
                              </span>
                            )}
                          </div>
                          {ev.notes && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{ev.notes}</p>
                          )}
                          <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                            {relativeTime(ev.timestamp, locale)} ·{" "}
                            {new Date(ev.timestamp).toLocaleTimeString(locale === "ar" ? "ar-SA" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── Bookings tab ─── */}
          {tab === "bookings" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    value={bookingFilter}
                    onChange={(e) => setBookingFilter(e.target.value)}
                    placeholder={tb("searchPlaceholder")}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
                <Button size="sm" asChild>
                  <Link href={`/dashboard/bookings/new?customerId=${customer.id}`}>
                    <Plus className="size-4" />
                    {tb("newBooking")}
                  </Link>
                </Button>
              </div>

              {filteredBookings.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">{t("empty")}</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {filteredBookings.map((b) => (
                    <div
                      key={b.id}
                      className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{b.serviceName}</span>
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_BG[b.status] ?? "")}>
                            {ts(STATUS_KEY[b.status] ?? "pending")}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {b.date} · {formatTime12(b.startTime, locale)}
                          {b.staffName ? ` · ${b.staffName}` : ""}
                        </p>
                        {b.notes && (
                          <p className="mt-0.5 text-xs text-muted-foreground/70">{b.notes}</p>
                        )}
                      </div>
                      {b.paymentAmount != null && (
                        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          {b.paymentAmount} SAR
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Stats tab ─── */}
          {tab === "stats" && (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Top services */}
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm">{t("custStatsTopServices")}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {topServices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("empty")}</p>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {topServices.map((s) => {
                        const max = topServices[0]?.count ?? 1
                        const pct = Math.round((s.count / max) * 100)
                        return (
                          <div key={s.name} className="flex flex-col gap-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium truncate">{s.name}</span>
                              <span className="tabular-nums text-muted-foreground">{s.count}×</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <motion.div
                                className="h-full rounded-full bg-primary/70"
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Monthly trend */}
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm">{t("custStatsMonthly")}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <SimpleBarChart data={monthlyTrend} />
                </CardContent>
              </Card>

              {/* Quick stats */}
              <Card className="md:col-span-2">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div className="text-center">
                      <p className="text-3xl font-extrabold text-primary">{customer.totalBookings}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t("custKpiTotal")}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-extrabold text-red-500">{customer.totalNoShows}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t("custKpiNoShows")}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-extrabold text-emerald-600">{customer.totalSpent.toFixed(0)}</p>
                      <p className="text-xs text-muted-foreground mt-1">SAR {t("custKpiSpent")}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-extrabold">{avgSpend}</p>
                      <p className="text-xs text-muted-foreground mt-1">SAR {t("custKpiAvgSpend")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
