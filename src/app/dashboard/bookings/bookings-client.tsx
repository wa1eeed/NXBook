"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  Check,
  Search,
  X,
  UserCheck,
  UserX,
  CalendarDays,
  Copy,
  CalendarClock,
  Plus,
  Download,
} from "lucide-react"
import {
  transitionBooking,
  getAvailableSlotsAction,
  rescheduleBookingAction,
} from "./actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { formatTime12 } from "@/lib/time"
import { MotionList, MotionItem } from "@/components/ui/motion-list"
import { cn } from "@/lib/utils"

type StatusFilter =
  | "all"
  | "PENDING"
  | "CONFIRMED"
  | "ATTENDED"
  | "NO_SHOW"
  | "CANCELLED"

const STATUS_FILTERS: { value: StatusFilter; labelKey: string }[] = [
  { value: "all", labelKey: "filterAll" },
  { value: "PENDING", labelKey: "filterPending" },
  { value: "CONFIRMED", labelKey: "filterConfirmed" },
  { value: "ATTENDED", labelKey: "filterAttended" },
  { value: "NO_SHOW", labelKey: "filterNoShow" },
  { value: "CANCELLED", labelKey: "filterCancelled" },
]

type DatePreset = "all" | "today" | "week" | "month" | "custom"

export interface BookingRow {
  id: string
  shortId: string
  date: string
  startTime: string
  endTime: string
  status: string
  serviceName: string
  serviceId: string
  staffName: string | null
  staffId: string | null
  customerName: string
  customerPhone: string
  bookedVia: string
  paymentStatus: string | null
  paymentAmount: number | null
  notes: string | null
}

interface Option {
  id: string
  name: string
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  CONFIRMED: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  ATTENDED: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  NO_SHOW: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  CANCELLED: "bg-muted text-muted-foreground",
}

const STATUS_KEY: Record<string, string> = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  ATTENDED: "attended",
  NO_SHOW: "noShow",
  CANCELLED: "cancelled",
}

const PAYMENT_STYLE: Record<string, string> = {
  UNPAID: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  PAID: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  REFUNDED: "bg-muted text-muted-foreground",
  WAIVED: "bg-muted/60 text-muted-foreground",
}

function startOfWeek(d: Date) {
  const c = new Date(d)
  const day = c.getDay()
  c.setDate(c.getDate() - day)
  c.setHours(0, 0, 0, 0)
  return c
}

export function BookingsClient({
  bookings,
  services,
  staff,
  paymentEnabled,
}: {
  bookings: BookingRow[]
  services: Option[]
  staff: Option[]
  paymentEnabled: boolean
}) {
  const t = useTranslations("bookings")
  const ts = useTranslations("status")
  const locale = useLocale()
  const router = useRouter()
  const reduce = useReducedMotion()
  const offscreen = locale === "ar" ? "-100%" : "100%"
  const [pending, startTransition] = useTransition()

  const [status, setStatus] = useState<StatusFilter>("all")
  const [query, setQuery] = useState("")
  const [datePreset, setDatePreset] = useState<DatePreset>("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [serviceId, setServiceId] = useState("")
  const [staffId, setStaffId] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Reschedule slide-over state.
  const [resched, setResched] = useState<BookingRow | null>(null)

  const today = new Date().toISOString().slice(0, 10)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const now = new Date()
    const weekStart = startOfWeek(now)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    return bookings.filter((b) => {
      if (status !== "all" && b.status !== status) return false
      if (serviceId && b.serviceId !== serviceId) return false
      if (staffId && b.staffId !== staffId) return false

      if (datePreset === "today" && b.date !== today) return false
      if (datePreset === "week" && new Date(b.date) < weekStart) return false
      if (datePreset === "month" && new Date(b.date) < monthStart) return false
      if (datePreset === "custom") {
        if (from && b.date < from) return false
        if (to && b.date > to) return false
      }

      if (q) {
        const hay = `${b.customerName} ${b.customerPhone} ${b.shortId}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [bookings, status, query, datePreset, from, to, serviceId, staffId, today])

  function act(id: string, action: "confirm" | "attend" | "cancel" | "noShow") {
    startTransition(async () => {
      const res = await transitionBooking(id, action)
      if (res.ok) {
        toast.success(t(`toast.${action}`))
        router.refresh()
      } else {
        toast.error(t(`error.${res.error}`))
      }
    })
  }

  async function copyPhone(phone: string) {
    try {
      await navigator.clipboard.writeText(phone)
      toast.success(t("copied"))
    } catch {
      toast.error(t("error.notFound"))
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected((prev) => {
      if (prev.size === filtered.length) return new Set()
      return new Set(filtered.map((b) => b.id))
    })
  }

  function buildCsv(rows: BookingRow[]) {
    const header = [
      "id",
      "date",
      "startTime",
      "endTime",
      "status",
      "service",
      "staff",
      "customer",
      "phone",
      "bookedVia",
      "paymentStatus",
      "paymentAmount",
    ]
    const escape = (v: string | number | null) => {
      const s = v == null ? "" : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = rows.map((b) =>
      [
        b.id,
        b.date,
        b.startTime,
        b.endTime,
        b.status,
        b.serviceName,
        b.staffName,
        b.customerName,
        b.customerPhone,
        b.bookedVia,
        b.paymentStatus,
        b.paymentAmount,
      ]
        .map(escape)
        .join(","),
    )
    return [header.join(","), ...lines].join("\n")
  }

  function downloadCsv(rows: BookingRow[]) {
    const csv = buildCsv(rows)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `bookings-${today}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function bulkTransition(action: "confirm" | "cancel") {
    const ids = [...selected]
    startTransition(async () => {
      await Promise.all(ids.map((id) => transitionBooking(id, action)))
      toast.success(t(action === "confirm" ? "toast.bulkConfirm" : "toast.bulkCancel"))
      setSelected(new Set())
      router.refresh()
    })
  }

  const allSelected = filtered.length > 0 && selected.size === filtered.length
  const active = (s: string) => s === "PENDING" || s === "CONFIRMED"

  return (
    <div className="flex flex-col gap-6 pb-20">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        action={
          <Button asChild>
            <Link href="/dashboard/bookings/new">
              <Plus className="size-4" />
              {t("newBooking")}
            </Link>
          </Button>
        }
      />

      {/* Filters bar */}
      <div className="flex flex-col gap-3">
        {/* Status tabs */}
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatus(f.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                status === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>

        {/* Date presets */}
        <div className="flex flex-wrap items-center gap-1">
          {(["all", "today", "week", "month"] as DatePreset[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setDatePreset(p)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                datePreset === p
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {p === "all"
                ? t("filterAll")
                : p === "today"
                  ? t("dateToday")
                  : p === "week"
                    ? t("dateWeek")
                    : t("dateMonth")}
            </button>
          ))}
          <div className="flex items-center gap-2 ps-2">
            <label className="text-xs text-muted-foreground">{t("dateFrom")}</label>
            <Input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value)
                setDatePreset("custom")
              }}
              className="h-9 w-auto"
            />
            <label className="text-xs text-muted-foreground">{t("dateTo")}</label>
            <Input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value)
                setDatePreset("custom")
              }}
              className="h-9 w-auto"
            />
          </div>
        </div>

        {/* Search + dropdowns + export */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="ps-9"
            />
          </div>
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">{t("filterService")}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">{t("filterStaff")}</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            onClick={() => downloadCsv(filtered)}
            disabled={filtered.length === 0}
          >
            <Download className="size-4" />
            {t("exportCsv")}
          </Button>
        </div>
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={t("empty")}
          description={t("emptyDesc")}
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title={t("resultsCount", { n: 0 })} />
      ) : (
        <>
          <label className="flex w-fit items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="size-4 rounded border-input"
            />
            {t("selectAll")}
          </label>

          <MotionList
            key={`${status}-${query}-${datePreset}-${serviceId}-${staffId}`}
            className="flex flex-col gap-3"
          >
            {filtered.map((b) => (
              <MotionItem key={b.id}>
                <Card className="transition-shadow hover:shadow-soft">
                  <CardContent className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected.has(b.id)}
                        onChange={() => toggleSelect(b.id)}
                        className="mt-1 size-4 shrink-0 rounded border-input"
                        aria-label={b.customerName}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                            {t("shortId")}
                            {b.shortId}
                          </span>
                          <p className="font-medium">{b.customerName}</p>
                          <button
                            type="button"
                            onClick={() => copyPhone(b.customerPhone)}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            title={t("copyPhone")}
                          >
                            {b.customerPhone}
                            <Copy className="size-3" />
                          </button>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-medium",
                              STATUS_STYLE[b.status] ?? "",
                            )}
                          >
                            {ts(STATUS_KEY[b.status] ?? "pending")}
                          </span>
                          {paymentEnabled && b.paymentStatus && (
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-xs font-medium",
                                PAYMENT_STYLE[b.paymentStatus] ?? "",
                              )}
                            >
                              {b.paymentStatus}
                            </span>
                          )}
                          {b.bookedVia === "waitlist" && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                              {t("fromWaitlist")}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {b.serviceName}
                          {b.staffName ? ` · ${b.staffName}` : ""} · {b.date}{" "}
                          {formatTime12(b.startTime, locale)}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-1">
                      {b.status === "PENDING" && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          onClick={() => act(b.id, "confirm")}
                        >
                          <Check className="size-4" />
                          {t("confirm")}
                        </Button>
                      )}
                      {active(b.status) && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pending}
                            onClick={() => act(b.id, "attend")}
                          >
                            <UserCheck className="size-4" />
                            {t("markAttended")}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pending}
                            onClick={() => act(b.id, "noShow")}
                          >
                            <UserX className="size-4" />
                            {t("markNoShow")}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pending}
                            onClick={() => setResched(b)}
                          >
                            <CalendarClock className="size-4" />
                            {t("reschedule")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            onClick={() => act(b.id, "cancel")}
                          >
                            <X className="size-4" />
                            {t("cancel")}
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </MotionItem>
            ))}
          </MotionList>
        </>
      )}

      {/* Sticky bulk-action bar */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm font-medium">
              {t("nSelected", { n: selected.size })}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => bulkTransition("confirm")}
              >
                <Check className="size-4" />
                {t("confirmSelected")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => {
                  if (confirm(t("cancelSelected"))) bulkTransition("cancel")
                }}
              >
                <X className="size-4" />
                {t("cancelSelected")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  downloadCsv(filtered.filter((b) => selected.has(b.id)))
                }
              >
                <Download className="size-4" />
                {t("exportSelected")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule slide-over */}
      <AnimatePresence>
        {resched && (
          <RescheduleDrawer
            booking={resched}
            offscreen={offscreen}
            reduce={!!reduce}
            onClose={() => setResched(null)}
            onDone={() => {
              setResched(null)
              router.refresh()
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function RescheduleDrawer({
  booking,
  offscreen,
  reduce,
  onClose,
  onDone,
}: {
  booking: BookingRow
  offscreen: string
  reduce: boolean
  onClose: () => void
  onDone: () => void
}) {
  const t = useTranslations("bookings")
  const locale = useLocale()
  const [pending, startTransition] = useTransition()
  const [date, setDate] = useState(booking.date)
  const [slots, setSlots] = useState<
    { startTime: string; endTime: string; remaining: number }[] | null
  >(null)
  const [loading, setLoading] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)

  function loadSlots(d: string) {
    setDate(d)
    setPicked(null)
    setLoading(true)
    startTransition(async () => {
      const res = await getAvailableSlotsAction(booking.serviceId, d)
      setSlots(res)
      setLoading(false)
    })
  }

  function confirm() {
    if (!picked) return
    startTransition(async () => {
      const res = await rescheduleBookingAction(booking.id, date, picked)
      if (res.ok) {
        toast.success(t("toast.reschedule"))
        onDone()
      } else {
        toast.error(t(`error.${res.error}`))
      }
    })
  }

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-black/40"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduce ? undefined : { opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed inset-y-0 end-0 z-50 flex w-full max-w-md flex-col overflow-y-auto border-s border-border bg-background shadow-xl"
        initial={reduce ? false : { x: offscreen }}
        animate={{ x: 0 }}
        exit={reduce ? undefined : { x: offscreen }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <p className="font-semibold">{t("rescheduleTitle")}</p>
            <p className="truncate text-sm text-muted-foreground">
              {booking.customerName} · {booking.serviceName}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("cancel")}>
            <X className="size-5" />
          </Button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <p className="text-sm text-muted-foreground">{t("selectNewSlot")}</p>
          <Input type="date" value={date} onChange={(e) => loadSlots(e.target.value)} />

          {loading ? (
            <p className="text-sm text-muted-foreground">…</p>
          ) : slots && slots.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((s) => (
                <button
                  key={s.startTime}
                  type="button"
                  disabled={s.remaining <= 0}
                  onClick={() => setPicked(s.startTime)}
                  className={cn(
                    "rounded-md border px-2 py-2 text-sm tabular-nums transition-colors disabled:opacity-40",
                    picked === s.startTime
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-accent",
                  )}
                >
                  {formatTime12(s.startTime, locale)}
                </button>
              ))}
            </div>
          ) : slots ? (
            <p className="text-sm text-muted-foreground">{t("error.slotUnavailable")}</p>
          ) : null}

          <Button onClick={confirm} disabled={pending || !picked}>
            {t("confirmReschedule")}
          </Button>
        </div>
      </motion.div>
    </>
  )
}
